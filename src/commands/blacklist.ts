import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('blacklist')
		.setDescription('Commands related to the name blacklist')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand((cmd) =>
			cmd
				.setName('add')
				.setDescription('Add a name to the blacklist')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Name to add')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(50),
				),
		)
		.addSubcommand((cmd) =>
			cmd
				.setName('remove')
				.setDescription('Remove a name from the blacklist')
				.addStringOption((option) => option.setName('name').setDescription('Name to remove').setRequired(true)),
		)
		.addSubcommand((cmd) => cmd.setName('list').setDescription('List all names in the blacklist'))
		.addSubcommand((cmd) => cmd.setName('clear').setDescription('Clear the blacklist'))
		.addSubcommand((cmd) =>
			cmd
				.setName('find')
				.setDescription('Find a name in the blacklist')
				.addStringOption((option) => option.setName('name').setDescription('Name to find').setRequired(true)),
		),
	description: 'Will be improved later on, with backwards compatibility.',
});
