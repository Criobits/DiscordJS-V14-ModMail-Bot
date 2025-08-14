const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { commandshandler, db } = require("..");

module.exports = new commandshandler.command({
    type: 1,
    structure: new SlashCommandBuilder()
        .setName('modmail')
        .setDescription('Gestore ModMail.')
        .addSubcommand((sub) =>
            sub.setName('ban')
                .setDescription("Banna un utente dall'utilizzo del ModMail.")
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription("L'utente da bannare.")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt.setName('reason')
                        .setDescription('Il motivo del ban.')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('unban')
                .setDescription("Sbanna un utente dall'utilizzo del ModMail.")
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription("L'utente da sbannare.")
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    run: async (client, interaction) => {

        const { options } = interaction;

        switch (options.getSubcommand()) {
            case 'ban': {
                const user = options.getUser('user', true);
                const reason = options.getString('reason') || 'Nessun motivo fornito';

                const count = await db.select('bans', { userId: user.id });

                if (count.length > 0) {
                    await interaction.reply({
                        content: 'Questo utente è già bannato.',
                        ephemeral: true
                    });

                    return;
                };

                await db.insert('bans', {
                    userId: user.id,
                    guildId: interaction.guild.id,
                    reason: reason
                });

                await interaction.reply({
                    content: "L'utente è stato bannato con successo.",
                    ephemeral: true
                });

                break;
            };

            case 'unban': {
                const user = options.getUser('user', true);

                const count = await db.select('bans', { userId: user.id });

                if (count.length <= 0) {
                    await interaction.reply({
                        content: 'Questo utente non è bannato.',
                        ephemeral: true
                    });

                    return;
                };

                await db.delete('bans', { userId: user.id });

                await interaction.reply({
                    content: "Il ban dell'utente è stato rimosso con successo.",
                    ephemeral: true
                });

                break;
            };
        };

    }
});