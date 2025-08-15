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
        guildId: '',
        transcriptChannelId: '1365783421292646401',
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