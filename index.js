const { CommandsHandler, EventsHandler } = require('horizon-handler');
const { Client, GatewayIntentBits, Partials, WebhookClient, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
require('colors');
require('dotenv').config();
const config = require("./config.js");
const projectVersion = require('./package.json').version;
const { footer } = require('./functions');

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

const webhookClient = (config.logs.webhookURL) ? new WebhookClient({ url: config.logs.webhookURL }) : null;

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
                inactivityWarningSent BOOLEAN DEFAULT FALSE
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
        console.log('Database tables checked/created successfully.'.green);
    } catch (error) {
        console.error('Error initializing database:'.red, error);
    }
}

async function checkInactivity() {
    try {
        const [openTickets] = await db.execute('SELECT * FROM mails WHERE closed = ?', [false]);
        if (openTickets.length === 0) return;

        const now = Date.now();
        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) return;

        for (const ticket of openTickets) {
            const timeSinceLastMessage = (now - ticket.lastMessageAt) / (1000 * 60 * 60); // in ore

            const channel = guild.channels.cache.get(ticket.channelId);
            if (!channel) {
                await db.execute('DELETE FROM mails WHERE id = ?', [ticket.id]); // Pulisce ticket orfani
                continue;
            };

            if (!ticket.inactivityWarningSent && timeSinceLastMessage >= config.options.inactivityTimeout) {
                await channel.send({
                    embeds: [new EmbedBuilder().setTitle('Avviso di Inattività').setDescription(`Questo ticket non riceve risposte da oltre ${config.options.inactivityTimeout} ore. Verrà chiuso automaticamente tra ${config.options.inactivityClose - config.options.inactivityTimeout} ore se non ci saranno ulteriori messaggi.`).setColor('Yellow').setFooter(footer).setTimestamp()]
                });
                await db.execute('UPDATE mails SET inactivityWarningSent = ? WHERE id = ?', [true, ticket.id]);
            }
            else if (ticket.inactivityWarningSent && timeSinceLastMessage >= config.options.inactivityClose) {
                const closeReason = `Chiuso automaticamente dopo ${config.options.inactivityClose} ore di inattività.`;
                
                await db.execute('UPDATE mails SET closed = ?, closedBy = ?, closeReason = ? WHERE id = ?', [true, client.user.id, closeReason, ticket.id]);
                await channel.delete(closeReason);
            }
        }
    } catch (error) {
        console.error("Errore durante il controllo dell'inattività:", error);
    }
}

console.log(`ModMail Bot - v${projectVersion}`.cyan.underline);

client.login(config.client.token).catch((e) => {
    console.error('Unable to connect. Invalid token or missing intents?'.red, e);
});

client.once('ready', () => {
    setInterval(checkInactivity, 1000 * 60 * 60); // Esegui ogni ora
});

const commandshandler = new CommandsHandler('./commands/', false);
const eventshandler = new EventsHandler('./events/', false);

commandshandler.on('fileLoad', (command) => console.log('Loaded command: ' + command.name));
eventshandler.on('fileLoad', (event) => console.log('Loaded event: ' + event));

module.exports = {
    client,
    webhookClient,
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