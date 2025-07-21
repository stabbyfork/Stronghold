import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('ranking')
		.setDescription('Todo')
		.addSubcommandGroup((group) =>
			group
				.setName('points')
				.setDescription('Todo')
				.addSubcommand((cmd) =>
					cmd.setName('view').setDescription('Todo'),
				)
				.addSubcommand((cmd) =>
					cmd.setName('add').setDescription('Todo'),
				)
				.addSubcommand((cmd) =>
					cmd.setName('remove').setDescription('Todo'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('ranks')
				.setDescription('Todo')
				.addSubcommand((cmd) =>
					cmd.setName('view').setDescription('Todo'),
				),
		),
	execute: async (interaction) => {
		await interaction.reply('Todo');
	},
	autocomplete: undefined,
});
