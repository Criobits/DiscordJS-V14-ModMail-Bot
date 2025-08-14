const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { eventshandler, db } = require("..");
const { logAction } = require("../functions");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;

        const isConfirmClose = customId.startsWith('confirm_close_');
        
        switch (true) {
            case customId === 'reply_ticket': {
                const modal = new ModalBuilder()
                    .setCustomId('reply_modal')
                    .setTitle('Rispondi al Ticket');

                const messageInput = new TextInputBuilder()
                    .setCustomId('reply_message_input')
                    .setLabel("Il tuo messaggio di risposta")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);
                    
                const anonymousInput = new TextInputBuilder()
                    .setCustomId('reply_anonymous_input')
                    .setLabel("Vuoi rispondere in anonimo? (sì/no)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(3)
                    .setPlaceholder('Scrivi "sì" per nascondere il tuo nome.');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(messageInput),
                    new ActionRowBuilder().addComponents(anonymousInput)
                );

                await interaction.showModal(modal);
                break;
            }

            case customId === 'assign_ticket': {
                await interaction.deferUpdate();
                const [rows] = await db.execute('SELECT * FROM mails WHERE channelId = ?', [interaction.channelId]);
                const data = rows[0];

                if (!data || data.assignedTo) {
                    return interaction.followUp({ content: 'Questo ticket è già stato preso in carico o non è più valido.', ephemeral: true });
                }

                await db.execute('UPDATE mails SET assignedTo = ? WHERE channelId = ?', [interaction.user.id, interaction.channelId]);

                const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
                const newEmbed = EmbedBuilder.from(originalMessage.embeds[0])
                    .addFields({ name: 'Assegnato a', value: interaction.user.toString() });

                await originalMessage.edit({ embeds: [newEmbed] });

                await logAction('Ticket Assegnato', 'Blue', [
                    { name: 'Ticket', value: interaction.channel.toString() },
                    { name: 'Assegnato a', value: interaction.user.toString(), inline: true },
                    { name: 'Autore Ticket', value: `<@${data.authorId}>`, inline: true }
                ]);

                break;
            }
            
            case customId === 'close_ticket': {
                const confirmationRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_close_${interaction.channelId}`)
                            .setLabel('Conferma Chiusura')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_close')
                            .setLabel('Annulla')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.reply({
                    content: 'Sei sicuro di voler chiudere questo ticket?',
                    components: [confirmationRow],
                    ephemeral: true
                });
                break;
            }

            case isConfirmClose: {
                const channelId = customId.replace('confirm_close_', '');
                const modal = new ModalBuilder()
                    .setCustomId(`close_ticket_modal_${channelId}`)
                    .setTitle('Motivo della Chiusura');
                
                const reasonInput = new TextInputBuilder()
                    .setCustomId('close_reason_input')
                    .setLabel("Perché stai chiudendo questo ticket?")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setPlaceholder('Nessun motivo (opzionale)');

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
                break;
            }

            case customId === 'cancel_close': {
                await interaction.update({ content: 'Chiusura annullata.', components: [] });
                break;
            }
        }
    }
});