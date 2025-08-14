const { EmbedBuilder } = require("discord.js");
const { eventshandler, db } = require("..");
const config = require("../config");
const { permissionsCalculator } = require("../functions");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== 'reply_modal') return;

        await interaction.deferReply({ ephemeral: true });

        const data = (await db.select('mails', { channelId: interaction.channelId }))[0];
        if (!data) return interaction.editReply({ content: 'Impossibile trovare i dati di questo ticket.' });
        
        const user = await client.users.fetch(data.authorId).catch(() => null);
        if (!user) return interaction.editReply({ content: "L'autore del mail non è stato trovato." });

        const message = interaction.fields.getTextInputValue('reply_message_input');
        const anonymousResponse = interaction.fields.getTextInputValue('reply_anonymous_input').toLowerCase();
        const isAnonymous = ['sì', 'si', 'yes', 'y'].includes(anonymousResponse);

        const perms = permissionsCalculator(interaction.member);

        const userEmbed = new EmbedBuilder()
            .setDescription(message)
            .setColor('Blurple');

        if (isAnonymous) {
            userEmbed.setAuthor({
                name: `Staff [${perms}]`,
                iconURL: interaction.guild.iconURL()
            });
        } else {
            userEmbed.setAuthor({
                name: `${interaction.user.displayName} [${perms}]`,
                iconURL: interaction.user.displayAvatarURL()
            });
        }

        const dmSent = await user.send({ embeds: [userEmbed] }).catch(() => null);

        if (!dmSent) {
            return interaction.editReply({ content: "Messaggio non inviato. L'utente ha i DM chiusi o mi ha bloccato." });
        }
        
        const channelEmbed = new EmbedBuilder()
            .setDescription(message)
            .setColor(isAnonymous ? 'Greyple' : 'Green');

        channelEmbed.setAuthor({
            name: `Risposta inviata da ${interaction.user.displayName}${isAnonymous ? ' (Anonimamente)' : ''}`,
            iconURL: interaction.user.displayAvatarURL()
        });
        
        await interaction.channel.send({ embeds: [channelEmbed] });

        await interaction.editReply({ content: 'Risposta inviata con successo!' });
    }
});