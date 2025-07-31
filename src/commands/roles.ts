import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types.js';

export default createCommand({
	data: new SlashCommandBuilder().setName('roles').setDescription('Todo'),
});
