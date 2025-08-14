const { eventshandler, commandshandler, db } = require("..");
const config = require("../config");

module.exports = new eventshandler.event({
    event: 'ready',
    once: true,
    run: async (client) => {

        console.log(`Logged in as: ${client.user.displayName}`.green);

        await commandshandler.deploy(client, { REST: { version: '10' } });

        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) {
            console.log('ID gilda non valido in config.js.'.red);
            return process.exit(1);
        }

        console.log('Checking database for invalid mails...'.yellow);

        const [mails] = await db.execute('SELECT channelId FROM mails WHERE guildId = ?', [guild.id]);
        let deletedCount = 0;

        for (const mail of mails) {
            if (!guild.channels.cache.has(mail.channelId)) {
                await db.execute('DELETE FROM mails WHERE channelId = ?', [mail.channelId]);
                deletedCount++;
            }
        }
        
        console.log(`Found and deleted ${deletedCount} invalid mails.`.blue);
    }
});