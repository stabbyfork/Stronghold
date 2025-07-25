import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types';

export default createCommand({
	data: new SlashCommandBuilder().setName('roles').setDescription('Todo'),
	execute: async (interaction) => {},
});
