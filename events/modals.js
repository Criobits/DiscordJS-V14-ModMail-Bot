const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { eventshandler, db } = require("..");
const { permissionsCalculator, logAction } = require("../functions");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isModalSubmit()) return;

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

            const perms = permissionsCalculator(interaction.member);
            const userEmbed = new EmbedBuilder().setDescription(message).setColor('Blurple');

            if (isAnonymous) {
                userEmbed.setAuthor({ name: `Staff [${perms}]`, iconURL: interaction.guild.iconURL() });
            } else {
                userEmbed.setAuthor({ name: `${interaction.user.displayName} [${perms}]`, iconURL: interaction.user.displayAvatarURL() });
            }

            const dmSent = await user.send({ embeds: [userEmbed] }).catch(() => null);

            if (!dmSent) {
                return interaction.editReply({ content: "Messaggio non inviato. L'utente ha i DM chiusi o mi ha bloccato." });
            }
            
            const channelEmbed = new EmbedBuilder()
                .setDescription(message)
                .setColor(isAnonymous ? 'Greyple' : 'Green')
                .setAuthor({
                    name: `Risposta inviata da ${interaction.user.displayName}${isAnonymous ? ' (Anonimamente)' : ''}`,
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

        if (customId.startsWith('close_ticket_modal_')) {
            await interaction.deferUpdate();
            
            const channelId = customId.replace('close_ticket_modal_', '');
            const channel = await client.channels.cache.get(channelId);
            if (!channel) return;

            const reason = interaction.fields.getTextInputValue('close_reason_input') || 'Nessun motivo fornito.';
            
            const [rows] = await db.execute('SELECT * FROM mails WHERE channelId = ?', [channelId]);
            const data = rows[0];
            if (!data) return;

            // Transcript
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(Embed o allegato)'}`).join('\n');

            // Update DB
            await db.execute('UPDATE mails SET closed = ?, closedBy = ?, closeReason = ? WHERE channelId = ?', [true, interaction.user.id, reason, channelId]);

            // Invia DM
            try {
                const user = await client.users.fetch(data.authorId);
                await user.send({
                    embeds: [new EmbedBuilder().setTitle('Il tuo ticket è stato chiuso').setDescription(`**Motivo**: ${reason}`)]
                });
                await user.send({
                    files: [new AttachmentBuilder(Buffer.from(transcript), { name: `cronologia-${channel.name}.txt` })]
                });
            } catch (e) {
                console.error(`Impossibile inviare DM di chiusura a ${data.authorId}`);
            }

            // Log
            await logAction('Ticket Chiuso', 'Red', [
                { name: 'Ticket (canale)', value: `\`${channel.name}\`` },
                { name: 'Chiuso da', value: interaction.user.toString(), inline: true },
                { name: 'Autore Ticket', value: `<@${data.authorId}>`, inline: true },
                { name: 'Motivo', value: reason }
            ]);
            
            // Elimina Canale
            await channel.delete('Ticket ModMail chiuso.');
        }
    }
});