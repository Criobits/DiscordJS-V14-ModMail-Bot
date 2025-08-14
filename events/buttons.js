const { EmbedBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { eventshandler, db, webhookClient } = require("..");
const config = require("../config");
const { time } = require("../functions");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {

        if (!interaction.isButton()) return;

        const allowedCategoryIds = config.modmail.categories.map(c => c.categoryId);
        if (interaction.channel && !allowedCategoryIds.includes(interaction.channel.parentId)) return;

        switch (interaction.customId) {
            case 'reply_ticket': {
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

            case 'close_ticket': {
                await interaction.reply({ content: 'Chiusura del ticket in corso...', ephemeral: true });

                const transcriptMessages = [];
                const messages = await interaction.channel.messages.fetch();

                for (const message of messages.values()) {
                    if (message.embeds.length > 0 && message.author.id === client.user.id) {
                        const embed = message.embeds[0];
                        transcriptMessages.push(`[${new Date(message.createdTimestamp).toLocaleString()}] ${embed.author?.name || 'Bot'}: ${embed.description || ''}`);
                    } else if (message.content) {
                        transcriptMessages.push(`[${new Date(message.createdTimestamp).toLocaleString()}] ${message.author.displayName}: ${message.content}`);
                    }
                }
                transcriptMessages.reverse();
                
                const data = (await db.select('mails', { channelId: interaction.channelId }))[0];
                if (data) {
                    await db.delete('mails', { channelId: interaction.channelId });
                }

                await interaction.channel.delete('Ticket ModMail chiuso.');

                if (!data) return;
                const user = await client.users.fetch(data.authorId).catch(() => null);
                if (!user) return;

                await user.send({
                    embeds: [ new EmbedBuilder().setTitle('Il tuo mail è stato chiuso.').setDescription(`**${interaction.user.displayName}** ha chiuso il tuo mail. Grazie per averci contattato!`) ]
                }).catch(null);

                await user.send({
                    content: 'Ecco la cronologia dei messaggi del tuo ticket:',
                    files: [ new AttachmentBuilder(Buffer.from(transcriptMessages.join('\n'), 'utf-8'), { name: 'cronologia-ticket.txt' })]
                }).catch(null);

                if (webhookClient) {
                    await webhookClient.send({
                        embeds: [ new EmbedBuilder().setTitle('Mail chiuso').setDescription(`Il mail di <@${data.authorId}> è stato chiuso da ${interaction.user.toString()}.`).setColor('Red') ]
                    });
                }
                break;
            };
        };
    }
});