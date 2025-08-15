const { GuildMember, EmbedBuilder } = require("discord.js");
const { webhookClient } = require('..');

/**
 * @param {number} ms
 */
const wait = (ms) => {
    return new Promise((res) => setTimeout(res, ms));
};

/**
 * @param {number} ms
 * @param {import("discord.js").TimestampStylesString} style
 */
const time = (ms, style) => {
    return `<t:${Math.floor(ms / 1000)}${style ? `:${style}>` : '>'}`;
};

/**
 * @param {GuildMember} member 
 */
const permissionsCalculator = (member) => {
    let final = 'Member';
    if (member.permissions.has('BanMembers') || member.permissions.has('KickMembers')) final = 'Moderator';
    if (member.permissions.has('ManageGuild')) final = 'Manager';
    if (member.permissions.has('Administrator')) final = 'Administrator';
    if (member.user.id === member.guild.ownerId) final = 'Owner';
    return final;
};

const footer = {
    text: 'Supporto WildLands',
    iconURL: 'https://upload.criobits.com/u/bBDI4R4jqwM8.png'
};

/**
 * Invia un log dettagliato al webhook configurato.
 * @param {string} title - Il titolo del log.
 * @param {import("discord.js").ColorResolvable} color - Il colore dell'embed.
 * @param {Array<{name: string, value: string, inline?: boolean}>} fields - I campi da aggiungere all'embed.
 */
async function logAction(title, color, fields = []) {
    if (!webhookClient) return;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setTimestamp()
        .setFooter(footer);
    
    if (fields.length > 0) {
        embed.addFields(fields);
    }

    try {
        await webhookClient.send({ embeds: [embed] });
    } catch (error) {
        console.error("Impossibile inviare il log tramite webhook:", error);
    }
}

module.exports = {
    wait,
    time,
    permissionsCalculator,
    logAction,
    footer
};