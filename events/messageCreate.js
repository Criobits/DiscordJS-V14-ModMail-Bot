const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, roleMention, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { eventshandler, db } = require("..");
const config = require("../config");
const { logAction, footer } = require("../functions");

const set = new Set();

module.exports = new eventshandler.event({
    event: 'messageCreate',
    run: async (client, message) => {
        if (message.author.bot) return;

        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) return console.error("ID Gilda non valido.".red);

        try {
            // Logica per i messaggi inviati in un server (canali)
            if (message.guild) {
                // Controlla se è un comando (inizia con !)
                if (message.content.startsWith('!')) {
                    const commandName = message.content.substring(1).split(' ')[0].toLowerCase();
                    
                    // Cerca prima un comando personalizzato
                    const [customCmdData] = await db.execute('SELECT * FROM custom_commands WHERE commandName = ? AND guildId = ?', [commandName, message.guild.id]);

                    if (customCmdData.length > 0) {
                        const cmd = customCmdData[0];
                        const embed = new EmbedBuilder()
                            .setTitle(cmd.embedTitle)
                            .setDescription(cmd.embedDescription)
                            .setColor('Gold')
                            .setFooter(footer)
                            .setTimestamp();
                        
                        if (cmd.embedThumbnail && (cmd.embedThumbnail.startsWith('http://') || cmd.embedThumbnail.startsWith('https://'))) {
                            embed.setThumbnail(cmd.embedThumbnail);
                        }
                        
                        await message.channel.send({ embeds: [embed] });
                        await message.delete().catch(() => {});

                        const [ticketData] = await db.execute('SELECT * FROM mails WHERE channelId = ? AND closed = ?', [message.channel.id, false]);
                        if (ticketData.length > 0) {
                            const ticket = ticketData[0];
                            const user = await client.users.fetch(ticket.authorId).catch(() => null);

                            if (user) {
                                try {
                                    await user.send({ embeds: [embed] });
                                    await db.execute('UPDATE mails SET lastMessageAt = ?, inactivityWarningSent = ? WHERE id = ?', [Date.now(), false, ticket.id]);
                                    await logAction(client, 'Comando Personalizzato Inviato', 'Gold', [
                                        { name: 'Ticket', value: message.channel.toString() },
                                        { name: 'Staff', value: message.author.toString() },
                                        { name: 'Comando Usato', value: `\`!${commandName}\`` }
                                    ]);
                                } catch (error) {
                                    console.error(`Impossibile inviare DM del comando personalizzato a ${ticket.authorId}`, error);
                                    const tempMsg = await message.channel.send({ content: `*(Attenzione: Impossibile inviare questo messaggio all'utente. Potrebbe avere i DM chiusi.)*` });
                                    setTimeout(() => tempMsg.delete().catch(() => {}), 10000);
                                }
                            }
                        }
                        return;
                    }
                }

                // Logica per i canali dei ticket (COMANDI RAPIDI !r e !ar)
                const [ticketData] = await db.execute('SELECT * FROM mails WHERE channelId = ? AND closed = ?', [message.channel.id, false]);
                if (ticketData.length === 0) return;

                const isReply = message.content.startsWith('!r');
                const isAnonReply = message.content.startsWith('!ar');

                if (isReply || isAnonReply) {
                    const content = message.content.substring(isReply ? 2 : 3).trim();
                    const attachments = message.attachments;

                    if (!content && attachments.size === 0) {
                        const tempMsg = await message.reply({ content: 'Devi specificare un messaggio o allegare un file.' });
                        setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
                        return;
                    }

                    const ticket = ticketData[0];
                    const user = await client.users.fetch(ticket.authorId).catch(() => null);
                    if (!user) return message.reply({ content: "Impossibile trovare l'utente del ticket." });
                    
                    try {
                        if (content) {
                            const userEmbed = new EmbedBuilder().setDescription(content).setColor('Blurple').setFooter(footer).setTimestamp();
                            if (isAnonReply) {
                                userEmbed.setAuthor({ name: 'Staff', iconURL: guild.iconURL() });
                            } else {
                                userEmbed.setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() });
                            }
                            await user.send({ embeds: [userEmbed] });
                        }

                        if (attachments.size > 0) {
                            await user.send({ content: `Hai ricevuto ${attachments.size} allegato/i:`, files: attachments.map(a => a) });
                        }

                        if (content) {
                            const channelEmbed = new EmbedBuilder().setDescription(content).setColor(isAnonReply ? 'Greyple' : 'Green').setAuthor({ name: `Risposta da ${message.author.displayName}${isAnonReply ? ' (Anonima)' : ''}`, iconURL: message.author.displayAvatarURL() }).setFooter(footer).setTimestamp();
                            await message.channel.send({ embeds: [channelEmbed] });
                        }
                        
                        if (attachments.size > 0) {
                            await message.channel.send({ content: `Allegati inviati da ${message.author.displayName}:`, files: attachments.map(a => a) });
                        }

                        let logMessage = content ? content.substring(0, 1024) : '(Nessun testo, solo allegati)';
                        if (content && attachments.size > 0) {
                            logMessage += `\n*(${attachments.size} allegato/i inviato/i)*`;
                        } else if (!content && attachments.size > 0) {
                            logMessage = `*(${attachments.size} allegato/i inviato/i)*`;
                        }

                        await logAction(client, 'Risposta Rapida Inviata', isAnonReply ? 'Greyple' : 'Green', [
                            { name: 'Ticket', value: message.channel.toString() },
                            { name: 'Staff', value: `${message.author.toString()}${isAnonReply ? ' (Anonimo)' : ''}` },
                            { name: 'Messaggio', value: logMessage }
                        ]);

                        await db.execute('UPDATE mails SET lastMessageAt = ?, inactivityWarningSent = ? WHERE id = ?', [Date.now(), false, ticket.id]);
                        await message.delete();

                    } catch (error) {
                        console.error("Errore invio risposta rapida:", error);
                        message.reply('Impossibile inviare il messaggio. L\'utente potrebbe avere i DM chiusi.');
                    }
                }
            
            // Logica per i DM (CREAZIONE TICKET)
            } else {
                const [bannedCheckr] = await db.execute('SELECT * FROM bans WHERE userId = ?', [message.author.id]);
                if (bannedCheckr.length > 0) {
                    return message.reply({ content: "Sei attualmente bannato dall'utilizzo del sistema ModMail.\n\n**Motivo**: " + (bannedCheckr[0].reason || 'Nessun motivo fornito.') });
                }

                const [data] = await db.execute('SELECT * FROM mails WHERE authorId = ? AND closed = ?', [message.author.id, false]);
                if (data.length > 0) {
                    const channel = guild.channels.cache.get(data[0].channelId);
                    if (channel) {
                        if (message.content) {
                            const embed = new EmbedBuilder().setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() }).setDescription(message.content).setColor('Blurple').setFooter(footer).setTimestamp();
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
                        await i.update({ content: `Creazione del ticket in corso...`, components: [] });

                        const now = Date.now();
                        const [result] = await db.execute('INSERT INTO mails (authorId, guildId, channelId, createdAt, lastMessageAt) VALUES (?, ?, ?, ?, ?)', [message.author.id, guild.id, 'PENDING', now, now]);
                        const ticketId = result.insertId;
                        
                        const channelPrefix = selectedCategory.channelName || selectedCategory.id;
                        const channelNameFormat = selectedCategory.channelNameFormat || 'username';
                        const channelName = channelNameFormat === 'ticketId' ? `${channelPrefix}-${ticketId}` : `${channelPrefix}-${message.author.username.substring(0, 15)}`;
                        
                        const permissions = [{ id: guild.roles.everyone.id, deny: ['ViewChannel'] }, ...selectedCategory.staffRoles.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] }))];
                        const newChannel = await guild.channels.create({ name: channelName, type: 0, parent: selectedCategory.categoryId, permissionOverwrites: permissions });
                        
                        await db.execute('UPDATE mails SET channelId = ? WHERE id = ?', [newChannel.id, ticketId]);
                        await i.editReply({ content: `Il tuo ticket in **${selectedCategory.name}** è stato creato!` });
                        
                        const embed = new EmbedBuilder()
                            .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
                            .setDescription(message.content || '(Nessun messaggio di testo)')
                            .setColor('Blurple')
                            .setTitle(`Nuovo Ticket #${ticketId} - ${selectedCategory.name}`)
                            .addFields({ name: 'Utente', value: `${message.author.tag} (\`${message.author.id}\`)` })
                            .setFooter(footer)
                            .setTimestamp();
                        
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
                        
                        await logAction(client, 'Nuovo Ticket Creato', 'Green', [{ name: 'Ticket ID', value: `#${ticketId}`, inline: true }, { name: 'Autore', value: message.author.toString(), inline: true }, { name: 'Categoria', value: selectedCategory.name, inline: true }, { name: 'Canale', value: newChannel.toString() }]);
                    } catch (error) {
                        console.error("ERRORE DURANTE LA CREAZIONE DEL TICKET:", error);
                        await i.editReply({ content: 'Si è verificato un errore durante la creazione del ticket. Contatta un amministratore.', components: [] }).catch(console.error);
                    }
                });
                collector.on('end', (collected, reason) => { if (reason === 'time') { set.delete(message.author.id); sent.edit({ content: 'Richiesta di apertura ticket scaduta.', components: [] }).catch(() => {}); } });
            }
        } catch (error) {
            console.error("ERRORE GENERALE IN messageCreate:", error);
        }
    }
});