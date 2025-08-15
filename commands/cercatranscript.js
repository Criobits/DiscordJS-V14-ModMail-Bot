const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { commandshandler, db } = require("..");
const { footer } = require("../functions");

module.exports = new commandshandler.command({
    type: 1,
    structure: new SlashCommandBuilder()
        .setName('cerca-transcript')
        .setDescription('Cerca tutti i ticket passati di un utente.')
        .addUserOption(option => 
            option.setName('utente')
                .setDescription('L\'utente di cui cercare i ticket.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('utente');

        try {
            const [tickets] = await db.execute(
                'SELECT * FROM mails WHERE authorId = ? AND closed = ? ORDER BY createdAt DESC LIMIT 10',
                [user.id, true]
            );

            if (tickets.length === 0) {
                return interaction.editReply({ content: 'Nessun ticket chiuso trovato per questo utente.' });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Storico Ticket per ${user.tag}`)
                .setColor('Blue')
                .setFooter(footer)
                .setTimestamp();

            for (const ticket of tickets) {
                const closedByTag = ticket.closedBy === client.user.id ? 'Sistema' : (await client.users.fetch(ticket.closedBy).catch(() => null))?.tag || 'Sconosciuto';
                embed.addFields({
                    name: `Ticket #${ticket.id} (Chiuso il ${new Date(ticket.lastMessageAt).toLocaleDateString('it-IT')})`,
                    value: `**Chiuso da:** ${closedByTag}\n**Motivo:** ${ticket.closeReason}`
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Errore durante la ricerca dei transcript:", error);
            await interaction.editReply({ content: 'Si è verificato un errore durante la ricerca.' });
        }
    }
});