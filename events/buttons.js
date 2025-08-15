const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { eventshandler, db } = require("..");

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