const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, roleMention, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { eventshandler, db, webhookClient } = require("..");
const config = require("../config");
const { logAction } = require("../functions");

const set = new Set();

module.exports = new eventshandler.event({
    event: 'messageCreate',
    run: async (client, message) => {
        if (message.author.bot || message.guild) return;

        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) return console.error("ID Gilda non valido o bot non presente nel server specificato in config.js".red);

        try {
            const [bannedCheckr] = await db.execute('SELECT * FROM bans WHERE userId = ?', [message.author.id]);
            if (bannedCheckr.length > 0) {
                return message.reply({ content: "Sei attualmente bannato dall'utilizzo del sistema ModMail.\n\n**Motivo**: " + (bannedCheckr[0].reason || 'Nessun motivo fornito.') });
            }

            const [data] = await db.execute('SELECT * FROM mails WHERE authorId = ? AND closed = ?', [message.author.id, false]);
            if (data.length > 0) {
                const channel = guild.channels.cache.get(data[0].channelId);
                if (channel) {
                    if (message.content) {
                        const embed = new EmbedBuilder()
                            .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
                            .setDescription(message.content)
                            .setColor('Blurple');
                        await channel.send({ embeds: [embed] });
                    }

                    if (message.attachments.size > 0) {
                        for (const attachment of message.attachments.values()) {
                            await channel.send({ content: `Allegato da ${message.author.displayName}:`, files: [attachment] });
                        }
                    }
                    
                    await db.execute('UPDATE mails SET lastMessageAt = ?, inactivityWarningSent = ? WHERE id = ?', [Date.now(), false, data[0].id]);
                    return message.react('📨');
                }
            }

            if (set.has(message.author.id)) {
                return message.reply({ content: 'Hai già una richiesta di apertura ticket in corso. Completa quella prima di inviare nuovi messaggi.' });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('create_ticket_category')
                .setPlaceholder('Seleziona una categoria per il tuo ticket')
                .addOptions(config.modmail.categories.map(category => new StringSelectMenuOptionBuilder().setLabel(category.name).setValue(category.id).setDescription(category.description).setEmoji(category.emoji || '✉️')));
            
            const row = new ActionRowBuilder().addComponents(selectMenu);
            set.add(message.author.id);
            const sent = await message.reply({ content: `Ciao! Per aprire un ticket, scegli la categoria appropriata. Il tuo messaggio qui sopra sarà il primo del ticket.`, components: [row] });
            
            const collector = sent.createMessageComponentCollector({ filter: i => i.customId === 'create_ticket_category' && i.user.id === message.author.id, time: 60000 });
            
            collector.on('collect', async i => {
                try {
                    const selectedCategoryId = i.values[0];
                    const selectedCategory = config.modmail.categories.find(c => c.id === selectedCategoryId);
                    if (!selectedCategory) return i.update({ content: 'Categoria non valida.', components: [] });

                    collector.stop();
                    set.delete(message.author.id);
                    
                    const permissions = [{ id: guild.roles.everyone.id, deny: ['ViewChannel'] }, ...selectedCategory.staffRoles.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] }))];
                    
                    const newChannel = await guild.channels.create({ name: `${selectedCategory.id}-${message.author.username}`, type: 0, parent: selectedCategory.categoryId, permissionOverwrites: permissions });
                    
                    const now = Date.now();
                    await db.execute('INSERT INTO mails (authorId, guildId, channelId, createdAt, lastMessageAt) VALUES (?, ?, ?, ?, ?)', [message.author.id, guild.id, newChannel.id, now, now]);
                    
                    await i.update({ content: `Il tuo ticket in **${selectedCategory.name}** è stato creato!`, components: [] });
                    
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
                        .setDescription(message.content || '(Nessun messaggio di testo)')
                        .setColor('Blurple')
                        .setTitle(`Nuovo Ticket - ${selectedCategory.name}`)
                        .addFields({ name: 'Utente', value: `${message.author.tag} (\`${message.author.id}\`)` });
                    
                    const ticketActionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reply_ticket').setLabel('Rispondi').setStyle(ButtonStyle.Success).setEmoji('✉️'),
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Chiudi Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );
                    
                    await newChannel.send({ content: selectedCategory.mentionStaffRolesOnNewMail ? selectedCategory.staffRoles.map(r => roleMention(r)).join(' ') : null, embeds: [embed], components: [ticketActionRow] }).then(sentPin => sentPin.pin());
                    
                    if (message.attachments.size > 0) {
                        for (const attachment of message.attachments.values()) {
                            await newChannel.send({ content: `Allegato iniziale da ${message.author.displayName}:`, files: [attachment] });
                        }
                    }

                    await logAction('Nuovo Ticket Creato', 'Green', [{ name: 'Autore', value: message.author.toString(), inline: true }, { name: 'Categoria', value: selectedCategory.name, inline: true }, { name: 'Canale', value: newChannel.toString() }]);
                } catch (error) {
                    console.error("ERRORE DURANTE LA CREAZIONE DEL TICKET:", error);
                    await i.update({ content: 'Si è verificato un errore durante la creazione del ticket. Contatta un amministratore.', components: [] }).catch(console.error);
                }
            });
            collector.on('end', (collected, reason) => { if (reason === 'time') { set.delete(message.author.id); sent.edit({ content: 'Richiesta di apertura ticket scaduta.', components: [] }).catch(() => {}); } });
        } catch (error) {
            console.error("ERRORE GENERALE IN messageCreate:", error);
        }
    }
});