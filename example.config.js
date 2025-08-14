module.exports = {
    client: {
        token: process.env.CLIENT_TOKEN || '', // Il token del tuo bot
        id: '' // L'ID del tuo bot
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'modmail'
    },
    modmail: {
        guildId: '', // L'ID del tuo server
        categories: [
            {
                name: 'Supporto Generale',
                id: 'supporto_generale',
                categoryId: '',
                staffRoles: ['ROLE_ID_1'],
                mentionStaffRolesOnNewMail: true,
                emoji: '🛠️',
                description: 'Apri un ticket per domande generiche.'
            },
        ]
    },
    logs: {
        webhookURL: process.env.WEBHOOK_URL || ''
    }
};