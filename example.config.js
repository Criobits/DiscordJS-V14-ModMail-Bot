module.exports = {
    client: {
        token: '', // ← Il token del tuo bot (.env È RACCOMANDATO)
        id: '' // ← L'ID del tuo bot
    },
    modmail: {
        guildId: '', // ← L'ID del tuo server
        categories: [
            {
                name: 'Supporto Generale', // Nome visualizzato nel menu di selezione
                id: 'supporto_generale', // ID unico, senza spazi o caratteri speciali
                categoryId: '', // ← ID della categoria Discord per i ticket di supporto
                staffRoles: ['ROLE_ID_1', 'ROLE_ID_2'], // ← Array di ID dei ruoli staff che possono vedere questi ticket
                mentionStaffRolesOnNewMail: true, // true o false, per menzionare i ruoli
                emoji: '🛠️', // Emoji opzionale per il menu
                description: 'Apri un ticket per domande generiche o aiuto.' // Descrizione nel menu
            },
            {
                name: 'Amministrazione',
                id: 'amministrazione',
                categoryId: '', // ← ID della categoria Discord per i ticket admin
                staffRoles: ['ADMIN_ROLE_ID'], // ← Array di ID dei ruoli dei soli responsabili/admin
                mentionStaffRolesOnNewMail: true,
                emoji: '👑',
                description: 'Contatta direttamente i responsabili per questioni private.'
            }
        ]
    },
    logs: {
        webhookURL: '' // ← L'URL del webhook per i log (OPZIONALE) (.env È RACCOMANDATO)
    }
};