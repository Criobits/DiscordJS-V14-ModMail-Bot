const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require("discord.js");
const { commandshandler, db } = require("..");
const { logAction } = require("../functions");
const config = require("../config");

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
        .addSubcommand((sub) =>
            sub.setName('move')
                .setDescription('Sposta il ticket corrente in un\'altra categoria.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    run: async (client, interaction) => {
        try {
            const { options } = interaction;

            switch (options.getSubcommand()) {
                case 'ban': {
                    const user = options.getUser('user', true);
                    const reason = options.getString('reason') || 'Nessun motivo fornito';

                    const [rows] = await db.execute('SELECT * FROM bans WHERE userId = ?', [user.id]);
                    if (rows.length > 0) return interaction.reply({ content: 'Questo utente è già bannato.', ephemeral: true });

                    await db.execute('INSERT INTO bans (userId, guildId, reason) VALUES (?, ?, ?)', [user.id, interaction.guild.id, reason]);

                    await logAction(client, 'Utente Bannato dal ModMail', 'DarkRed', [
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

                    await logAction(client, 'Utente Sbannato dal ModMail', 'Green', [
                        { name: 'Utente', value: user.toString(), inline: true },
                        { name: 'Staff', value: interaction.user.toString(), inline: true }
                    ]);
                    
                    await interaction.reply({ content: "Il ban dell'utente è stato rimosso con successo.", ephemeral: true });
                    break;
                }

                case 'move': {
                    const [ticketData] = await db.execute('SELECT * FROM mails WHERE channelId = ? AND closed = ?', [interaction.channelId, false]);
                    if (ticketData.length === 0) {
                        return interaction.reply({ content: 'Questo comando può essere usato solo in un canale di un ticket aperto.', ephemeral: true });
                    }

                    const currentParentId = interaction.channel.parentId;
                    const availableCategories = config.modmail.categories.filter(cat => cat.categoryId !== currentParentId);

                    if (availableCategories.length === 0) {
                        return interaction.reply({ content: 'Non ci sono altre categorie in cui spostare questo ticket.', ephemeral: true });
                    }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('move_ticket_category')
                        .setPlaceholder('Seleziona la nuova categoria')
                        .addOptions(
                            availableCategories.map(category => ({
                                label: category.name,
                                value: category.id,
                                description: category.description,
                                emoji: category.emoji || '📁'
                            }))
                        );

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    const reply = await interaction.reply({
                        content: 'Scegli la categoria di destinazione per questo ticket.',
                        components: [row],
                        ephemeral: true,
                        fetchReply: true
                    });

                    const collector = reply.createMessageComponentCollector({
                        componentType: ComponentType.StringSelect,
                        time: 60000,
                        filter: i => i.user.id === interaction.user.id
                    });

                    collector.on('collect', async i => {
                        const newCategoryId = i.values[0];
                        const newCategory = config.modmail.categories.find(c => c.id === newCategoryId);
                        const oldCategory = config.modmail.categories.find(c => c.categoryId === currentParentId) || { name: 'Sconosciuta' };
                        
                        if (!newCategory) {
                            return i.update({ content: 'Categoria non valida.', components: [] });
                        }

                        const newPermissions = [
                            { id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] },
                            ...newCategory.staffRoles.map(roleId => ({
                                id: roleId,
                                allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory']
                            }))
                        ];

                        await interaction.channel.edit({
                            parent: newCategory.categoryId,
                            permissionOverwrites: newPermissions
                        });

                        await i.update({ content: `Ticket spostato con successo nella categoria **${newCategory.name}**.`, components: [] });

                        await interaction.channel.send(`✅ Ticket spostato da **${oldCategory.name}** a **${newCategory.name}** da ${interaction.user.toString()}.`);

                        await logAction(client, 'Ticket Spostato', 'Orange', [
                            { name: 'Ticket', value: interaction.channel.toString(), inline: true },
                            { name: 'Staff', value: interaction.user.toString(), inline: true },
                            { name: 'Da Categoria', value: oldCategory.name, inline: false },
                            { name: 'A Categoria', value: newCategory.name, inline: false },
                        ]);

                        collector.stop();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            interaction.editReply({ content: 'Richiesta scaduta.', components: [] }).catch(() => {});
                        }
                    });

                    break;
                }
            }
        } catch (error) {
            console.error("ERRORE NEL COMANDO /modmail:", error);
            await interaction.reply({ content: 'Si è verificato un errore durante l\'esecuzione del comando.', ephemeral: true }).catch(() => {});
        }
    }
});