const { CommandsHandler, EventsHandler } = require('horizon-handler');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
require('colors');
require('dotenv').config();
const config = require("./config.js");
const projectVersion = require('./package.json').version;
const { logAction, footer } = require('./functions');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message],
    presence: {
        activities: [{
            name: "Scrivimi in DM per creare un ticket!",
            type: 1,
            url: "https://criobits.com"
        }]
    },
    shards: "auto"
});

const db = mysql.createPool({
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS bans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                guildId VARCHAR(255) NOT NULL,
                reason TEXT
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS mails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                authorId VARCHAR(255) NOT NULL,
                guildId VARCHAR(255) NOT NULL,
                channelId VARCHAR(255) NOT NULL,
                closed BOOLEAN DEFAULT FALSE,
                closedBy VARCHAR(255) NULL,
                closeReason TEXT NULL,
                createdAt BIGINT NOT NULL,
                lastMessageAt BIGINT NOT NULL,
                autoCloseAt BIGINT NULL
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ratings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticketId INT NOT NULL,
                userId VARCHAR(255) NOT NULL,
                rating INT NOT NULL,
                timestamp BIGINT NOT NULL,
                FOREIGN KEY (ticketId) REFERENCES mails(id) ON DELETE CASCADE
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS custom_commands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guildId VARCHAR(255) NOT NULL,
                commandName VARCHAR(255) NOT NULL,
                embedTitle TEXT,
                embedDescription TEXT,
                embedThumbnail VARCHAR(255) NULL,
                createdBy VARCHAR(255) NOT NULL,
                createdAt BIGINT NOT NULL,
                UNIQUE (guildId, commandName)
            );
        `);
        console.log('Database tables checked/created successfully.'.green);
    } catch (error) {
        console.error('Error initializing database:'.red, error);
    }
}

async function checkAutoClose() {
    try {
        const [ticketsToClose] = await db.execute('SELECT * FROM mails WHERE closed = ? AND autoCloseAt IS NOT NULL AND autoCloseAt < ?', [false, Date.now()]);
        if (ticketsToClose.length === 0) return;

        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) return;

        for (const ticket of ticketsToClose) {
            const channel = guild.channels.cache.get(ticket.channelId);
            if (channel) {
                const closeReason = 'Chiuso automaticamente per inattività dopo 24 ore.';
                await db.execute('UPDATE mails SET closed = ?, closedBy = ?, closeReason = ? WHERE id = ?', [true, client.user.id, closeReason, ticket.id]);
                await channel.delete(closeReason);
                await logAction(client, 'Ticket Chiuso Automaticamente', 'Red', [
                    { name: 'Ticket ID', value: `#${ticket.id}`},
                    { name: 'Autore', value: `<@${ticket.authorId}>`}
                ]);
            }
        }
    } catch (error) {
        console.error("Errore durante il controllo dell'autoclose:", error);
    }
}

console.log(`ModMail Bot - v${projectVersion}`.cyan.underline);

client.login(config.client.token).catch((e) => {
    console.error('Unable to connect. Invalid token or missing intents?'.red, e);
});

client.once('ready', () => {
    setInterval(checkAutoClose, 1000 * 60 * 5); // Esegui ogni 5 minuti
});

const commandshandler = new CommandsHandler('./commands/', false);
const eventshandler = new EventsHandler('./events/', false);

commandshandler.on('fileLoad', (command) => console.log('Loaded command: ' + command.name));
eventshandler.on('fileLoad', (event) => console.log('Loaded event: ' + event));

module.exports = {
    client,
    db,
    commandshandler,
    eventshandler
};

(async () => {
    await initializeDatabase();
    await commandshandler.load();
    await eventshandler.load(client);
})();

process.on('unhandledRejection', (reason, promise) => {
    console.error("[ANTI-CRASH] unhandledRejection:".yellow, reason, promise);
});

process.on("uncaughtException", (err, origin) => {
    console.error("[ANTI-CRASH] uncaughtException:".yellow, err, origin);
});