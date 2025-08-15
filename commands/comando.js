const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { commandshandler, db } = require("..");
const { footer } = require("../functions");

module.exports = new commandshandler.command({
    type: 1,
    structure: new SlashCommandBuilder()
        .setName('comando')
        .setDescription('Gestisce i comandi personalizzati con risposta embed.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('crea')
                .setDescription('Crea un nuovo comando personalizzato.')
                .addStringOption(opt => opt.setName('nome').setDescription('Il nome del comando (senza !).').setRequired(true))
                .addStringOption(opt => opt.setName('titolo').setDescription('Il titolo dell\'embed.').setRequired(true))
                .addStringOption(opt => opt.setName('descrizione').setDescription('Il testo dell\'embed. Usa \\n per andare a capo.').setRequired(true))
                .addStringOption(opt => opt.setName('thumbnail').setDescription('L\'URL dell\'immagine thumbnail (opzionale).').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('elimina')
                .setDescription('Elimina un comando personalizzato.')
                .addStringOption(opt => opt.setName('nome').setDescription('Il nome del comando da eliminare.').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName('lista')
                .setDescription('Mostra tutti i comandi personalizzati creati.')
        ),
    
    // Autocompletamento per il comando /comando elimina
    autocomplete: async (client, interaction) => {
        const focusedValue = interaction.options.getFocused();
        const [commands] = await db.execute('SELECT commandName FROM custom_commands WHERE guildId = ?', [interaction.guild.id]);
        const choices = commands.map(cmd => cmd.commandName);
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    },

    run: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            if (sub === 'crea') {
                const nome = interaction.options.getString('nome').toLowerCase();
                const titolo = interaction.options.getString('titolo');
                const descrizione = interaction.options.getString('descrizione').replace(/\\n/g, '\n');
                const thumbnail = interaction.options.getString('thumbnail');

                const [existing] = await db.execute('SELECT id FROM custom_commands WHERE guildId = ? AND commandName = ?', [guildId, nome]);
                if (existing.length > 0) {
                    return interaction.reply({ content: `Un comando con il nome \`!${nome}\` esiste già.`, ephemeral: true });
                }

                await db.execute(
                    'INSERT INTO custom_commands (guildId, commandName, embedTitle, embedDescription, embedThumbnail, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [guildId, nome, titolo, descrizione, thumbnail, interaction.user.id, Date.now()]
                );

                await interaction.reply({ content: `Comando \`!${nome}\` creato con successo!`, ephemeral: true });
            } 
            
            else if (sub === 'elimina') {
                const nome = interaction.options.getString('nome');
                const [result] = await db.execute('DELETE FROM custom_commands WHERE guildId = ? AND commandName = ?', [guildId, nome]);

                if (result.affectedRows > 0) {
                    await interaction.reply({ content: `Comando \`!${nome}\` eliminato con successo.`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `Nessun comando trovato con il nome \`!${nome}\`.`, ephemeral: true });
                }
            } 
            
            else if (sub === 'lista') {
                const [commands] = await db.execute('SELECT commandName FROM custom_commands WHERE guildId = ?', [guildId]);
                if (commands.length === 0) {
                    return interaction.reply({ content: 'Non ci sono comandi personalizzati su questo server.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('Comandi Personalizzati')
                    .setDescription(commands.map(cmd => `\`!${cmd.commandName}\``).join('\n'))
                    .setColor('Blue')
                    .setFooter(footer);
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (error) {
            console.error("Errore nel comando /comando:", error);
            await interaction.reply({ content: 'Si è verificato un errore.', ephemeral: true });
        }
    }
});