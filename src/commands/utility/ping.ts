import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../../types';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with pong. Just for testing purposes'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
});
