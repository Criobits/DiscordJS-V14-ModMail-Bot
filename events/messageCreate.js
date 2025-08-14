const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, roleMention, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { eventshandler, db, webhookClient } = require("..");
const config = require("../config");

const set = new Set();

module.exports = new eventshandler.event({
    event: 'messageCreate',
    run: async (client, message) => {
        if (message.author.bot || message.guild) return;

        try {
            const [bannedCheckr] = await db.execute('SELECT * FROM bans WHERE userId = ?', [message.author.id]);
            if (bannedCheckr.length > 0) {
                return message.reply({
                    content: "Sei attualmente bannato dall'utilizzo del sistema ModMail.\n\n**Motivo**: " + (bannedCheckr[0].reason || 'Nessun motivo fornito.')
                });
            }

            const [data] = await db.execute('SELECT * FROM mails WHERE authorId = ? AND closed = ?', [message.author.id, false]);
            const guild = client.guilds.cache.get(config.modmail.guildId);
            if (!guild) return;

            if (data.length > 0) {
                const channel = guild.channels.cache.get(data[0].channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
                        .setDescription(message.content?.length > 0 ? message.content : null)
                        .setColor('Blurple');
                    if (message.attachments.size > 0) embed.setImage(message.attachments.first().url);
                    await channel.send({ embeds: [embed] });
                    return message.react('📨');
                }
            }

            if (set.has(message.author.id)) return;

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
                content: `Ciao! Per aprire un ticket, scegli la categoria appropriata.`,
                components: [row]
            });

            const collector = sent.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                time: 60000 
            });

            collector.on('collect', async i => {
                const categoryId = i.values[0];
                const category = config.modmail.categories.find(c => c.id === categoryId);
                if (!category) return;

                collector.stop();
                set.delete(message.author.id);

                const channel = await guild.channels.create({
                    name: `${category.id}-${message.author.username}`,
                    type: 0,
                    parent: category.categoryId,
                    permissionOverwrites: [
                        { id: guild.id, deny: ['ViewChannel'] },
                        ...category.staffRoles.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] }))
                    ]
                });
                
                await db.execute('INSERT INTO mails (authorId, guildId, channelId) VALUES (?, ?, ?)', [message.author.id, guild.id, channel.id]);
                await i.update({ content: `Il tuo ticket in **${category.name}** è stato creato!`, components: [] });

                const embed = new EmbedBuilder()
                    .setTitle(`Nuovo mail - ${category.name}`)
                    .addFields(
                        { name: `Autore`, value: `${message.author.tag} (\`${message.author.id}\`)` },
                        { name: `Messaggio Iniziale`, value: message.content || 'Nessun messaggio di testo.' }
                    )
                    .setColor('Blurple');
                if (message.attachments.size > 0) embed.setImage(message.attachments.first().url);

                const ticketActionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('reply_ticket').setLabel('Rispondi').setStyle(ButtonStyle.Success).setEmoji('✉️'),
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Chiudi Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );
                
                let initialContent = category.mentionStaffRolesOnNewMail ? category.staffRoles.map(r => roleMention(r)).join(' ') : '';
                await channel.send({ content: initialContent, embeds: [embed], components: [ticketActionRow] }).then(m => m.pin());

                if (webhookClient) await webhookClient.send({ embeds: [ new EmbedBuilder().setTitle('Nuovo mail creato').setDescription(`Il mail di <@${message.author.id}> in **${category.name}** è stato creato.`).setColor('Green') ] });
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    set.delete(message.author.id);
                    sent.edit({ content: 'Richiesta di apertura ticket scaduta.', components: [] });
                }
            });
        } catch (error) {
            console.error('Errore in messageCreate:', error);
            message.reply('Si è verificato un errore, per favore riprova.');
        }
    }
});