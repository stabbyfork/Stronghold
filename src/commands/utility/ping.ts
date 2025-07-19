import { SlashCommandBuilder } from 'discord.js';
import { CommandConstruct } from '../../types';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with pong. Just for testing purposes'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
} satisfies CommandConstruct;
