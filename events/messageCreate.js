const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, roleMention, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { eventshandler, db, webhookClient } = require("..");
const config = require("../config");
const { time } = require("../functions");

const set = new Set();

module.exports = new eventshandler.event({
    event: 'messageCreate',
    run: async (client, message) => {
        if (message.author.bot) return;

        const guild = client.guilds.cache.get(config.modmail.guildId);
        
        if (message.guild) {
            const allowedCategoryIds = config.modmail.categories.map(c => c.categoryId);
            if (!allowedCategoryIds.includes(message.channel.parentId)) return;
            // I messaggi dello staff nel canale modmail vengono ignorati, devono usare i bottoni
            return;
        } else {
            const bannedCheckr = (await db.select('bans', { userId: message.author.id }))[0];
            if (bannedCheckr) {
                return message.reply({
                    content: "Sei attualmente bannato dall'utilizzo del sistema ModMail.\n\n**Motivo**: " + (bannedCheckr?.reason || 'Nessun motivo fornito.')
                });
            }

            const data = (await db.select('mails', { authorId: message.author.id }))[0];
            if (data) {
                 const channel = guild.channels.cache.get(data.channelId);
                 if (channel) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
                        .setDescription(message.content?.length > 0 ? message.content : null)
                        .setColor('Blurple');

                    if (message.attachments?.size) {
                        const imageAttachment = message.attachments.find(attachment => attachment.contentType.startsWith('image/'));
                        if (imageAttachment) {
                            embed.setImage(imageAttachment.proxyURL);
                        } else {
                            message.attachments.forEach(attachment => channel.send({ files: [attachment] }));
                        }
                    }
                    await channel.send({ embeds: [embed] });
                    return message.react('📨');
                 }
            }

            if (set.has(message.author.id)) {
                return message.reply({ content: 'Hai già una richiesta di apertura ticket in corso. Completa quella prima di inviare nuovi messaggi.' });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('create_ticket_category')
                .setPlaceholder('Seleziona una categoria per il tuo ticket')
                .addOptions(
                    config.modmail.categories.map(category =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(category.name)
                            .setValue(category.id)
                            .setDescription(category.description)
                            .setEmoji(category.emoji || '✉️')
                    )
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            set.add(message.author.id);

            const sent = await message.reply({
                content: `Ciao! Per aprire un ticket, scegli la categoria appropriata. Il tuo messaggio qui sopra sarà il primo del ticket.`,
                components: [row]
            });

            const collector = sent.createMessageComponentCollector({
                filter: i => i.customId === 'create_ticket_category' && i.user.id === message.author.id,
                time: 60000 
            });

            collector.on('collect', async i => {
                const selectedCategoryId = i.values[0];
                const selectedCategory = config.modmail.categories.find(c => c.id === selectedCategoryId);
                if (!selectedCategory) return i.update({ content: 'Categoria non valida.', components: [] });

                collector.stop();
                set.delete(message.author.id);

                const permissions = [
                    { id: guild.roles.everyone.id, deny: ['ViewChannel'] }
                ];
                selectedCategory.staffRoles.forEach(roleId => {
                    permissions.push({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] });
                });

                const newChannel = await guild.channels.create({
                    name: `${selectedCategory.id}-${message.author.username}`,
                    type: 0,
                    parent: selectedCategory.categoryId,
                    permissionOverwrites: permissions
                });

                await db.insert('mails', { authorId: message.author.id, channelId: newChannel.id, guildId: guild.id });
                await i.update({ content: `Il tuo ticket in **${selectedCategory.name}** è stato creato!`, components: [] });

                const embed = new EmbedBuilder()
                    .setTitle(`Nuovo mail - ${selectedCategory.name}`)
                    .addFields(
                        { name: `Autore`, value: `${message.author.displayName} (\`${message.author.id}\`)` },
                        { name: `Messaggio`, value: `${message.content?.length > 0 ? message.content : '(Nessuno)'}` }
                    )
                    .setColor('Blurple');
                
                if (message.attachments?.size > 0) {
                    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
                    if (imageAttachment) embed.setImage(imageAttachment.proxyURL);
                }

                const initialMessageContent = selectedCategory.mentionStaffRolesOnNewMail ? selectedCategory.staffRoles.map(r => roleMention(r)).join(' ') : null;

                const ticketActionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reply_ticket')
                            .setLabel('Rispondi')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✉️'),
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Chiudi Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                await newChannel.send({
                    content: initialMessageContent,
                    embeds: [embed],
                    components: [ticketActionRow]
                }).then(sentPin => sentPin.pin());

                if (webhookClient) await webhookClient.send({ embeds: [ new EmbedBuilder().setTitle('Nuovo mail creato').setDescription(`Il mail di <@${message.author.id}> in **${selectedCategory.name}** è stato creato.`).setColor('Green') ] });
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    set.delete(message.author.id);
                    sent.edit({ content: 'Richiesta di apertura ticket scaduta.', components: [] });
                }
            });
        }
    }
});