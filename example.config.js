module.exports = {
    client: {
        token: process.env.CLIENT_TOKEN || '',
        id: process.env.CLIENT_ID || ''
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'modmail',
        password: process.env.DB_PASSWORD || ''
    },
    modmail: {
        guildId: '', // ID del Server
        transcriptChannelId: '', // ID del canale per i Transcripts
        categories: [
            {
                name: 'Supporto Generale',
                id: 'supporto_generale', // ID unico per la logica interna
                channelName: 'supporto',   // Nome visualizzato nel canale
                categoryId: '', // ID della categoria
                staffRoles: ['ROLE_ID_1'], // ID dei Ruoli che possono vedere il ticket
                mentionStaffRolesOnNewMail: true,
                emoji: '🛠️',
                description: 'Apri un ticket per domande generiche.',
                channelNameFormat: 'username' // Opzioni: 'username' o 'ticketId'
            },
        ]
    },
    options: {
    inactivityTimeout: 48, // Ore prima dell'avviso di inattività
    inactivityClose: 72    // Ore prima della chiusura automatica
    },
    logs: {
        webhookURL: process.env.WEBHOOK_URL || ''
    }
};