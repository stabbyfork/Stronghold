import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types.js';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('session')
		.setDescription('Todo')
		.addSubcommand((cmd) => cmd.setName('status').setDescription('Todo'))
		.addSubcommand((cmd) => cmd.setName('start').setDescription('Todo'))
		.addSubcommand((cmd) =>
			cmd.setName('quickstart').setDescription('Todo'),
		)
		.addSubcommand((cmd) => cmd.setName('stop').setDescription('Todo'))
		.addSubcommand((cmd) => cmd.setName('join').setDescription('Todo'))
		.addSubcommand((cmd) => cmd.setName('edit').setDescription('Todo')),
});
