const { eventshandler, commandshandler, db } = require("..");
const config = require("../config");

module.exports = new eventshandler.event({
    event: 'ready',
    once: true,
    run: async (client) => {

        console.log(`Logged in as: ${client.user.displayName}`.green);

        await commandshandler.deploy(client, {
            REST: {
                version: '10'
            }
        });

        const guild = client.guilds.cache.get(config.modmail.guildId);
        if (!guild) {
            console.log('ID gilda non valido in config.js. Il bot non può funzionare senza un server valido.'.red);
            return process.exit(1);
        }

        console.log('Bot pronto e operativo.'.blue);
    }
});