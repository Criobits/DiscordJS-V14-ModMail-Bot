const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { commandshandler, db } = require("..");
const { logAction } = require("../functions");

module.exports = new commandshandler.command({
    type: 1,
    structure: new SlashCommandBuilder()
        .setName('modmail')
        .setDescription('Gestore ModMail.')
        .addSubcommand((sub) =>
            sub.setName('ban')
                .setDescription("Banna un utente dall'utilizzo del ModMail.")
                .addUserOption((opt) => opt.setName('user').setDescription("L'utente da bannare.").setRequired(true))
                .addStringOption((opt) => opt.setName('reason').setDescription('Il motivo del ban.').setRequired(false))
        )
        .addSubcommand((sub) =>
            sub.setName('unban')
                .setDescription("Sbanna un utente dall'utilizzo del ModMail.")
                .addUserOption((opt) => opt.setName('user').setDescription("L'utente da sbannare.").setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    run: async (client, interaction) => {
        const { options } = interaction;

        switch (options.getSubcommand()) {
            case 'ban': {
                const user = options.getUser('user', true);
                const reason = options.getString('reason') || 'Nessun motivo fornito';

                const [rows] = await db.execute('SELECT * FROM bans WHERE userId = ?', [user.id]);
                if (rows.length > 0) return interaction.reply({ content: 'Questo utente è già bannato.', ephemeral: true });

                await db.execute('INSERT INTO bans (userId, guildId, reason) VALUES (?, ?, ?)', [user.id, interaction.guild.id, reason]);

                await logAction('Utente Bannato dal ModMail', 'DarkRed', [
                    { name: 'Utente', value: user.toString(), inline: true },
                    { name: 'Staff', value: interaction.user.toString(), inline: true },
                    { name: 'Motivo', value: reason }
                ]);

                await interaction.reply({ content: "L'utente è stato bannato con successo.", ephemeral: true });
                break;
            }

            case 'unban': {
                const user = options.getUser('user', true);

                const [rows] = await db.execute('SELECT * FROM bans WHERE userId = ?', [user.id]);
                if (rows.length === 0) return interaction.reply({ content: 'Questo utente non è bannato.', ephemeral: true });

                await db.execute('DELETE FROM bans WHERE userId = ?', [user.id]);

                await logAction('Utente Sbannato dal ModMail', 'Green', [
                    { name: 'Utente', value: user.toString(), inline: true },
                    { name: 'Staff', value: interaction.user.toString(), inline: true }
                ]);
                
                await interaction.reply({ content: "Il ban dell'utente è stato rimosso con successo.", ephemeral: true });
                break;
            }
        }
    }
});