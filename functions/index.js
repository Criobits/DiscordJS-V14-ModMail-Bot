const { GuildMember, EmbedBuilder, ChannelType } = require("discord.js");
const config = require("../config");

const footer = {
    text: 'Supporto WildLands',
    iconURL: 'https://upload.criobits.com/u/bBDI4R4jqwM8.png'
};

/**
 * Invia un log dettagliato in un canale testuale.
 * @param {import("discord.js").Client} client - L'istanza del client del bot.
 * @param {string} title - Il titolo del log.
 * @param {import("discord.js").ColorResolvable} color - Il colore dell'embed.
 * @param {Array<{name: string, value: string, inline?: boolean}>} fields - I campi da aggiungere all'embed.
 */
async function logAction(client, title, color, fields = []) {
    const logChannelId = config.modmail.logChannelId;
    if (!logChannelId) {
        console.log(`Tentativo di inviare il log "${title}", ma logChannelId non è configurato in config.js.`.yellow);
        return;
    }

    try {
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== ChannelType.GuildText) {
            console.error(`logChannelId (${logChannelId}) non è un canale testuale valido.`.red);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp()
            .setFooter(footer);
        
        if (fields.length > 0) {
            embed.addFields(fields);
        }

        await logChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error("Impossibile inviare il log nel canale:", error);
    }
}

module.exports = {
    logAction,
    footer
};