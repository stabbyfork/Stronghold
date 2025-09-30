import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../../types/commandTypes.js';

export default createCommand({
	data: new SlashCommandBuilder().setName('invite').setDescription('Invite the bot to your own server!'),
	async execute(interaction) {
		await interaction.reply({
			content: `[Add the bot to your server here!](https://discord.com/oauth2/authorize?client_id=1185666263259824158)`,
		});
	},
});
