const { EmbedBuilder, AttachmentBuilder, ChannelType } = require("discord.js");
const { eventshandler, db } = require("..");
const { logAction } = require("../functions");
const config = require("../config");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isModalSubmit()) return;

        const customId = interaction.customId;

        // Logica per rispondere al ticket
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
            
            const userEmbed = new EmbedBuilder().setDescription(message).setColor('Blurple');

            if (isAnonymous) {
                userEmbed.setAuthor({ name: `Staff`, iconURL: interaction.guild.iconURL() });
            } else {
                userEmbed.setAuthor({ name: `${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL() });
            }

            const dmSent = await user.send({ embeds: [userEmbed] }).catch(() => null);

            if (!dmSent) {
                return interaction.editReply({ content: "Messaggio non inviato. L'utente ha i DM chiusi o mi ha bloccato." });
            }
            
            const channelEmbed = new EmbedBuilder()
                .setDescription(message)
                .setColor(isAnonymous ? 'Greyple' : 'Green')
                .setAuthor({
                    name: `Risposta da ${interaction.user.displayName}${isAnonymous ? ' (Anonima)' : ''}`,
                    iconURL: interaction.user.displayAvatarURL()
                });
            
            await interaction.channel.send({ embeds: [channelEmbed] });
            
            await logAction('Risposta Inviata', isAnonymous ? 'Greyple' : 'Green', [
                { name: 'Ticket', value: interaction.channel.toString() },
                { name: 'Staff', value: `${interaction.user.toString()}${isAnonymous ? ' (Anonimo)' : ''}` },
                { name: 'Messaggio', value: message.substring(0, 1024) }
            ]);
            
            await interaction.editReply({ content: 'Risposta inviata con successo!' });
        }
        
        // Logica per chiudere il ticket
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
                if (msg.author.id === client.user.id && msg.embeds.length > 0) {
                    const embed = msg.embeds[0];
                    const sender = embed.author?.name || 'Sconosciuto';
                    const content = embed.description || '(Nessun testo)';
                    const timestamp = new Date(msg.createdTimestamp).toLocaleString('it-IT');
                    
                    transcriptMessages.push(`[${timestamp}] ${sender}: ${content}`);
                }
            });

            const transcript = transcriptMessages.join('\n') || 'Nessuna conversazione registrata.';

            await db.execute('UPDATE mails SET closed = ?, closedBy = ?, closeReason = ? WHERE channelId = ?', [true, interaction.user.id, reason, channelId]);
            const author = await client.users.fetch(data.authorId).catch(() => ({ tag: 'Utente Sconosciuto' }));

            try {
                await author.send({
                    embeds: [new EmbedBuilder().setTitle('Il tuo ticket è stato chiuso').setDescription(`**Motivo**: ${reason}`)]
                });
            } catch (e) { console.error(`Impossibile inviare DM di chiusura a ${data.authorId}`); }

            await logAction('Ticket Chiuso', 'Red', [
                { name: 'Ticket (canale)', value: `\`${channel.name}\`` },
                { name: 'Chiuso da', value: interaction.user.toString(), inline: true },
                { name: 'Autore Ticket', value: author.toString(), inline: true },
                { name: 'Motivo', value: reason }
            ]);

            const transcriptChannelId = config.modmail.transcriptChannelId;
            if (transcriptChannelId) {
                const transcriptChannel = await client.channels.cache.get(transcriptChannelId);
                if (transcriptChannel && transcriptChannel.type === ChannelType.GuildText) {
                    const transcriptEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Transcript per ${author.tag}` })
                        .addFields(
                            { name: 'Autore Ticket', value: `${author.toString()} (\`${data.authorId}\`)`, inline: true },
                            { name: 'Chiuso da', value: `${interaction.user.toString()} (\`${interaction.user.id}\`)`, inline: true },
                            { name: 'Motivo', value: reason }
                        )
                        .setColor('Orange');
                    
                    await transcriptChannel.send({ 
                        embeds: [transcriptEmbed],
                        files: [new AttachmentBuilder(Buffer.from(transcript), { name: `cronologia-${channel.name}.txt` })]
                    });
                } else {
                    console.error("L'ID del canale transcript non è valido o non è un canale testuale.".red);
                }
            }
            
            await channel.delete('Ticket ModMail chiuso.');
        }
    }
});