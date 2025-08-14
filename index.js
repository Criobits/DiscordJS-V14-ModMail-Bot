const { CommandsHandler, EventsHandler } = require('horizon-handler');
const { Client, GatewayIntentBits, Partials, WebhookClient } = require('discord.js');
const mysql = require('mysql2/promise');
require('colors');
require('dotenv').config();
const config = require("./config.js");
const projectVersion = require('./package.json').version;

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
            name: "Scrivimi in DM per creare un mail!",
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
                closed BOOLEAN DEFAULT FALSE
            );
        `);
        console.log('Database tables checked/created successfully.'.green);
    } catch (error) {
        console.error('Error initializing database:'.red, error);
    }
}


console.log(`ModMail Bot - v${projectVersion}`.cyan.underline);

client.login(config.client.token).catch((e) => {
    console.error('Unable to connect. Invalid token or missing intents?'.red, e);
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