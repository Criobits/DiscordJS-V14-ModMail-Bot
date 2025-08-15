const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, EmbedBuilder } = require("discord.js");
const { commandshandler, db } = require("..");
const { logAction, footer } = require("../functions");
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
        .addSubcommand((sub) =>
            sub.setName('autoclose')
                .setDescription('Attiva un timer di 24h per la chiusura automatica del ticket.')
        )
        .addSubcommand((sub) =>
            sub.setName('create')
                .setDescription('Crea un nuovo ticket per un utente.')
                .addUserOption(opt => opt.setName('utente').setDescription('L\'utente per cui creare il ticket.').setRequired(true))
                .addStringOption(opt => opt.setName('categoria').setDescription('La categoria del ticket.').setRequired(true).setAutocomplete(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    autocomplete: async (client, interaction) => {
        const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === 'categoria') {
            const choices = config.modmail.categories.map(cat => ({ name: cat.name, value: cat.id }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
            await interaction.respond(filtered);
        }
    },

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
                    await logAction(client, 'Utente Bannato dal ModMail', 'DarkRed', [{ name: 'Utente', value: user.toString(), inline: true }, { name: 'Staff', value: interaction.user.toString(), inline: true }, { name: 'Motivo', value: reason }]);
                    await interaction.reply({ content: "L'utente è stato bannato con successo.", ephemeral: true });
                    break;
                }

                case 'unban': {
                    const user = options.getUser('user', true);
                    const [rows] = await db.execute('SELECT * FROM bans WHERE userId = ?', [user.id]);
                    if (rows.length === 0) return interaction.reply({ content: 'Questo utente non è bannato.', ephemeral: true });
                    await db.execute('DELETE FROM bans WHERE userId = ?', [user.id]);
                    await logAction(client, 'Utente Sbannato dal ModMail', 'Green', [{ name: 'Utente', value: user.toString(), inline: true }, { name: 'Staff', value: interaction.user.toString(), inline: true }]);
                    await interaction.reply({ content: "Il ban dell'utente è stato rimosso con successo.", ephemeral: true });
                    break;
                }

                case 'move': {
                    const [ticketData] = await db.execute('SELECT * FROM mails WHERE channelId = ? AND closed = ?', [interaction.channelId, false]);
                    if (ticketData.length === 0) return interaction.reply({ content: 'Questo comando può essere usato solo in un canale di un ticket aperto.', ephemeral: true });
                    const currentParentId = interaction.channel.parentId;
                    const availableCategories = config.modmail.categories.filter(cat => cat.categoryId !== currentParentId);
                    if (availableCategories.length === 0) return interaction.reply({ content: 'Non ci sono altre categorie in cui spostare questo ticket.', ephemeral: true });
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('move_ticket_category')
                        .setPlaceholder('Seleziona la nuova categoria')
                        .addOptions(availableCategories.map(category => ({ label: category.name, value: category.id, description: category.description, emoji: category.emoji || '📁' })));
                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    const reply = await interaction.reply({ content: 'Scegli la categoria di destinazione per questo ticket.', components: [row], ephemeral: true, fetchReply: true });
                    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: i => i.user.id === interaction.user.id });
                    collector.on('collect', async i => {
                        const newCategoryId = i.values[0];
                        const newCategory = config.modmail.categories.find(c => c.id === newCategoryId);
                        const oldCategory = config.modmail.categories.find(c => c.categoryId === currentParentId) || { name: 'Sconosciuta' };
                        if (!newCategory) return i.update({ content: 'Categoria non valida.', components: [] });
                        const newPermissions = [{ id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] }, ...newCategory.staffRoles.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] }))];
                        await interaction.channel.edit({ parent: newCategory.categoryId, permissionOverwrites: newPermissions });
                        await i.update({ content: `Ticket spostato con successo nella categoria **${newCategory.name}**.`, components: [] });
                        await interaction.channel.send(`✅ Ticket spostato da **${oldCategory.name}** a **${newCategory.name}** da ${interaction.user.toString()}.`);
                        await logAction(client, 'Ticket Spostato', 'Orange', [{ name: 'Ticket', value: interaction.channel.toString(), inline: true }, { name: 'Staff', value: interaction.user.toString(), inline: true }, { name: 'Da Categoria', value: oldCategory.name, inline: false }, { name: 'A Categoria', value: newCategory.name, inline: false }]);
                        collector.stop();
                    });
                    collector.on('end', (collected, reason) => { if (reason === 'time') { interaction.editReply({ content: 'Richiesta scaduta.', components: [] }).catch(() => {}); } });
                    break;
                }

                case 'autoclose': {
                    const [ticketData] = await db.execute('SELECT * FROM mails WHERE channelId = ? AND closed = ?', [interaction.channelId, false]);
                    if (ticketData.length === 0) return interaction.reply({ content: 'Questo comando può essere usato solo in un canale di un ticket aperto.', ephemeral: true });
                    const ticket = ticketData[0];
                    if (ticket.autoCloseAt) return interaction.reply({ content: 'Un timer per la chiusura automatica è già attivo per questo ticket.', ephemeral: true });
                    const closeTimestamp = Date.now() + 24 * 60 * 60 * 1000;
                    const closeTimeFormatted = `<t:${Math.floor(closeTimestamp / 1000)}:R>`;
                    await db.execute('UPDATE mails SET autoCloseAt = ? WHERE id = ?', [closeTimestamp, ticket.id]);
                    const warningEmbed = new EmbedBuilder()
                        .setTitle('Avviso di Chiusura Automatica')
                        .setDescription(`Questo ticket è stato contrassegnato per la chiusura automatica. Se non ci saranno nuove risposte da parte dell'utente, verrà chiuso ${closeTimeFormatted}.`)
                        .setColor('Yellow')
                        .setFooter(footer)
                        .setTimestamp();
                    await interaction.channel.send({ embeds: [warningEmbed] });
                    const user = await client.users.fetch(ticket.authorId).catch(() => null);
                    if (user) {
                        await user.send({ embeds: [warningEmbed] });
                    }
                    await logAction(client, 'Autoclose Attivato', 'Yellow', [{ name: 'Ticket ID', value: `#${ticket.id}` }, { name: 'Attivato da', value: interaction.user.toString() }, { name: 'Chiuderà il', value: `<t:${Math.floor(closeTimestamp / 1000)}:F>` }]);
                    await interaction.reply({ content: `Timer di 24 ore per la chiusura automatica attivato. Qualsiasi nuova risposta annullerà il timer.`, ephemeral: true });
                    break;
                }

                case 'create': {
                    await interaction.deferReply({ ephemeral: true });
                    const user = options.getUser('utente');
                    const categoryId = options.getString('categoria');
                    const selectedCategory = config.modmail.categories.find(c => c.id === categoryId);
                    if (!selectedCategory) return interaction.editReply({ content: 'Categoria non valida. Per favore scegline una dalla lista.' });
                    const [existingTicket] = await db.execute('SELECT * FROM mails WHERE authorId = ? AND closed = ?', [user.id, false]);
                    if (existingTicket.length > 0) {
                        const channel = interaction.guild.channels.cache.get(existingTicket[0].channelId);
                        return interaction.editReply({ content: `Questo utente ha già un ticket aperto: ${channel ? channel.toString() : 'canale non trovato'}.` });
                    }
                    const now = Date.now();
                    const [result] = await db.execute('INSERT INTO mails (authorId, guildId, channelId, createdAt, lastMessageAt) VALUES (?, ?, ?, ?, ?)', [user.id, interaction.guild.id, 'PENDING', now, now]);
                    const ticketId = result.insertId;
                    const channelPrefix = selectedCategory.channelName || selectedCategory.id;
                    const channelNameFormat = selectedCategory.channelNameFormat || 'username';
                    const channelName = channelNameFormat === 'ticketId' ? `${channelPrefix}-${ticketId}` : `${channelPrefix}-${user.username.substring(0, 15)}`;
                    const permissions = [{ id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] }, ...selectedCategory.staffRoles.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] }))];
                    const newChannel = await interaction.guild.channels.create({ name: channelName, type: 0, parent: selectedCategory.categoryId, permissionOverwrites: permissions });
                    await db.execute('UPDATE mails SET channelId = ? WHERE id = ?', [newChannel.id, ticketId]);
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
                        .setDescription(`Questo ticket è stato aperto manualmente dallo staff.`)
                        .setColor('Blurple')
                        .setTitle(`Nuovo Ticket #${ticketId} - ${selectedCategory.name}`)
                        .addFields({ name: 'Utente', value: `${user.tag} (\`${user.id}\`)` }, { name: 'Aperto da', value: interaction.user.toString() })
                        .setFooter(footer)
                        .setTimestamp();
                    const ticketActionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reply_ticket').setLabel('Rispondi').setStyle(ButtonStyle.Success).setEmoji('✉️'),
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Chiudi Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );
                    await newChannel.send({ content: selectedCategory.mentionStaffRolesOnNewMail ? selectedCategory.staffRoles.map(r => roleMention(r)).join(' ') : null, embeds: [embed], components: [ticketActionRow] }).then(sentPin => sentPin.pin());
                    try {
                        await user.send({ embeds: [new EmbedBuilder().setTitle('Lo Staff ha aperto un Ticket per te').setDescription(`Un membro dello staff ha aperto un ticket per discutere con te. Puoi rispondere direttamente a questo messaggio.`).setColor('Green').setFooter(footer).setTimestamp()] });
                    } catch (error) {
                        await newChannel.send(`*(Attenzione: non è stato possibile notificare l'utente in DM. Potrebbe avere i DM chiusi.)*`);
                    }
                    await logAction(client, 'Ticket Creato dallo Staff', 'Green', [{ name: 'Ticket ID', value: `#${ticketId}`, inline: true }, { name: 'Per Utente', value: user.toString(), inline: true }, { name: 'Staff', value: interaction.user.toString(), inline: true }, { name: 'Categoria', value: selectedCategory.name, inline: true }, { name: 'Canale', value: newChannel.toString(), inline: true }]);
                    await interaction.editReply({ content: `Ticket creato con successo per ${user.tag} in ${newChannel.toString()}.` });
                    break;
                }
            }
        } catch (error) {
            console.error("ERRORE NEL COMANDO /modmail:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Si è verificato un errore durante l\'esecuzione del comando.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.editReply({ content: 'Si è verificato un errore durante l\'esecuzione del comando.' }).catch(() => {});
            }
        }
    }
});