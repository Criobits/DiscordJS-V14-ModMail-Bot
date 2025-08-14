const { eventshandler, db } = require("..");

module.exports = new eventshandler.event({
    event: 'channelDelete',
    run: async (client, channel) => {
        try {
            await db.execute('DELETE FROM mails WHERE channelId = ?', [channel.id]);
        } catch (error) {
            console.error('Errore durante la rimozione del mail dal DB dopo l\'eliminazione del canale:', error);
        }
    }
});