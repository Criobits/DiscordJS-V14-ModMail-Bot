const { EmbedBuilder, AttachmentBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { eventshandler, db } = require("..");
const { logAction, footer } = require("../functions");
const config = require("../config");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isModalSubmit()) return;

        try {
            const customId = interaction.customId;

            if (customId === 'reply_modal') {
                await interaction.deferReply({ ephemeral: true });

                const [rows] = await db.execute('SELECT * FROM mails WHERE channelId = ?', [interaction.channelId]);
                const data = rows[0];
                if (!data) return interaction.editReply({ content: 'Impossibile trovare i dati di questo ticket.' });
                
                const user = await client.users.fetch(data.authorId).catch(() => null);
                if (!user) return interaction.editReply({ content: "L'autore del mail non è stato trovato." });

                const message = interaction.fields.getTextInputValue('reply_message_input');
                const anonymousResponse = interaction.fields.getTextInputValue('reply_anonymous_input').toLowerCase();
                const isAnonymous = ['sì', 'si', 'yes', 'y'].includes(anonymousResponse);
                
                const userEmbed = new EmbedBuilder().setDescription(message).setColor('Blurple').setFooter(footer).setTimestamp();
                if (isAnonymous) {
                    userEmbed.setAuthor({ name: `Staff`, iconURL: interaction.guild.iconURL() });
                } else {
                    userEmbed.setAuthor({ name: `${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL() });
                }

                await user.send({ embeds: [userEmbed] });
                
                const channelEmbed = new EmbedBuilder()
                    .setDescription(message)
                    .setColor(isAnonymous ? 'Greyple' : 'Green')
                    .setAuthor({ name: `Risposta da ${interaction.user.displayName}${isAnonymous ? ' (Anonima)' : ''}`, iconURL: interaction.user.displayAvatarURL() })
                    .setFooter(footer)
                    .setTimestamp();
                
                await interaction.channel.send({ embeds: [channelEmbed] });
                await db.execute('UPDATE mails SET lastMessageAt = ?, inactivityWarningSent = ? WHERE id = ?', [Date.now(), false, data.id]);
                
                await logAction(client, 'Risposta Inviata', isAnonymous ? 'Greyple' : 'Green', [{ name: 'Ticket', value: interaction.channel.toString() }, { name: 'Staff', value: `${interaction.user.toString()}${isAnonymous ? ' (Anonimo)' : ''}` }, { name: 'Messaggio', value: message.substring(0, 1024) }]);
                await interaction.editReply({ content: 'Risposta inviata con successo!' });
            }
            
            if (customId.startsWith('close_ticket_modal_')) {
                await interaction.deferUpdate();
                
                const channelId = customId.replace('close_ticket_modal_', '');
                const channel = await client.channels.cache.get(channelId);
                if (!channel) return;

                const reason = interaction.fields.getTextInputValue('close_reason_input') || 'Nessun motivo fornito.';
                
                const [rows] = await db.execute('SELECT * FROM mails WHERE channelId = ?', [channelId]);
                const data = rows[0];
                if (!data) return;

                const messages = await channel.messages.fetch({ limit: 100 });
                const transcriptMessages = [];
                messages.reverse().forEach(msg => {
                    if (msg.embeds.length > 0 && msg.author.id === client.user.id) {
                        const embed = msg.embeds[0];
                        const timestamp = new Date(msg.createdTimestamp).toLocaleString('it-IT');
                        
                        const sender = embed.author ? embed.author.name : (embed.title || 'Sistema');
                        const content = embed.description || '(Nessun testo)';

                        transcriptMessages.push(`[${timestamp}] ${sender}: ${content}`);
                    } else if (msg.attachments.size > 0) {
                        msg.attachments.forEach(att => transcriptMessages.push(`[${new Date(msg.createdTimestamp).toLocaleString('it-IT')}] ${msg.author.tag}: [ALLEGATO: ${att.url}]`));
                    }
                });
                const transcript = transcriptMessages.join('\n') || 'Nessuna conversazione registrata.';
                
                await db.execute('UPDATE mails SET closed = ?, closedBy = ?, closeReason = ? WHERE id = ?', [true, interaction.user.id, reason, data.id]);
                const author = await client.users.fetch(data.authorId).catch(() => ({ tag: 'Utente Sconosciuto' }));

                try {
                    await author.send({ embeds: [new EmbedBuilder().setTitle('Il tuo ticket è stato chiuso').setDescription(`**Motivo**: ${reason}`).setFooter(footer).setTimestamp()] });
                    await author.send({ content: 'Ecco la cronologia dei messaggi del tuo ticket:', files: [new AttachmentBuilder(Buffer.from(transcript), { name: `cronologia-${channel.name}.txt` })] });
                    
                    const feedbackRow = new ActionRowBuilder().addComponents(
                        [1, 2, 3, 4, 5].map(rating => new ButtonBuilder().setCustomId(`feedback_${rating}_${data.id}`).setLabel('⭐️'.repeat(rating)).setStyle(ButtonStyle.Primary))
                    );
                    const feedbackMessage = await author.send({ content: 'Come valuteresti il supporto ricevuto?', components: [feedbackRow] });
                    
                    const collector = feedbackMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1000 * 60 * 60 * 24 });
                    collector.on('collect', async btnInteraction => {
                        const rating = parseInt(btnInteraction.customId.split('_')[1]);
                        await db.execute('INSERT INTO ratings (ticketId, userId, rating, timestamp) VALUES (?, ?, ?, ?)', [data.id, author.id, rating, Date.now()]);
                        await btnInteraction.update({ content: `Grazie per aver lasciato una valutazione di ${'⭐️'.repeat(rating)}!`, components: [] });
                        collector.stop();
                        await logAction(client, 'Feedback Ricevuto', 'Gold', [{ name: 'Utente', value: author.toString(), inline: true }, { name: 'Valutazione', value: `${'⭐️'.repeat(rating)} (${rating}/5)`, inline: true }, { name: 'Ticket ID', value: `#${data.id}` }]);
                    });
                } catch (e) { console.error(`Impossibile inviare DM di chiusura o feedback a ${data.authorId}`); }

                await logAction(client, 'Ticket Chiuso', 'Red', [{ name: 'Ticket (canale)', value: `\`${channel.name}\`` }, { name: 'Chiuso da', value: interaction.user.toString(), inline: true }, { name: 'Autore Ticket', value: author.toString(), inline: true }, { name: 'Motivo', value: reason }]);
                
                const transcriptChannelId = config.modmail.transcriptChannelId;
                if (transcriptChannelId) {
                    const transcriptChannel = await client.channels.cache.get(transcriptChannelId);
                    if (transcriptChannel && transcriptChannel.type === ChannelType.GuildText) {
                        const transcriptEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Transcript per ${author.tag} - Ticket #${data.id}` })
                            .addFields({ name: 'Autore Ticket', value: `${author.toString()} (\`${data.authorId}\`)`, inline: true }, { name: 'Chiuso da', value: `${interaction.user.toString()} (\`${interaction.user.id}\`)`, inline: true }, { name: 'Motivo', value: reason })
                            .setColor('Orange')
                            .setFooter(footer)
                            .setTimestamp();
                        await transcriptChannel.send({ embeds: [transcriptEmbed], files: [new AttachmentBuilder(Buffer.from(transcript), { name: `cronologia-${channel.name}.txt` })] });
                    } else {
                        console.error("L'ID del canale transcript non è valido o non è un canale testuale.".red);
                    }
                }
                
                await channel.delete('Ticket ModMail chiuso.');
            }
        } catch (error) {
            console.error("ERRORE DURANTE LA GESTIONE DEL MODAL:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Si è verificato un errore. Per favore, riprova.', ephemeral: true }).catch(console.error);
            } else {
                await interaction.followUp({ content: 'Si è verificato un errore. Per favore, riprova.', ephemeral: true }).catch(console.error);
            }
        }
    }
});