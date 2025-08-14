const { EmbedBuilder } = require("discord.js");
const { eventshandler, db } = require("..");
const { permissionsCalculator } = require("../functions");

module.exports = new eventshandler.event({
    event: 'interactionCreate',
    run: async (client, interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== 'reply_modal') return;
        
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

        const userEmbed = new EmbedBuilder()
            .setDescription(message)
            .setColor('Blurple');

        if (isAnonymous) {
            userEmbed.setAuthor({ name: `Staff [${perms}]`, iconURL: interaction.guild.iconURL() });
        } else {
            userEmbed.setAuthor({ name: `${interaction.user.displayName} [${perms}]`, iconURL: interaction.user.displayAvatarURL() });
        }
        
        try {
            await user.send({ embeds: [userEmbed] });
            
            const channelEmbed = new EmbedBuilder()
                .setDescription(message)
                .setColor(isAnonymous ? 'Greyple' : 'Green')
                .setAuthor({ name: `Risposta da ${interaction.user.displayName}${isAnonymous ? ' (Anonima)' : ''}`, iconURL: interaction.user.displayAvatarURL() });
            
            await interaction.channel.send({ embeds: [channelEmbed] });
            await interaction.editReply({ content: 'Risposta inviata con successo!' });
        } catch (error) {
            console.error("Impossibile inviare DM di risposta:", error);
            interaction.editReply({ content: "Messaggio non inviato. L'utente potrebbe avere i DM chiusi o avermi bloccato." });
        }
    }
});