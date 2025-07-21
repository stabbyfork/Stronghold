import { AutocompleteInteraction, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../../types';
import { defaultEmbed } from '../../utils';
import { commands } from '../../commands';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription(
			'Replies with a list of all commands or details of a specific command',
		)
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to get help for')
				.setRequired(false)
				.setAutocomplete(true),
		),
	execute: async (interaction) => {
		const embed = defaultEmbed().setTitle('Help');
		const cmd = interaction.options.getString('command');
		// Info for one command
		if (cmd) {
			const command = commands[cmd as keyof typeof commands];
			if (!command) {
				await interaction.reply({
					content: 'Unknown command',
					ephemeral: true,
				});
				return;
			}
			embed.setAuthor({
				name: `Help for /${command.data.name}`,
			});
			embed.setDescription(command.data.description);
		} else {
			embed.setAuthor({
				name: 'All commands',
			});
			// Info for all commands
			for (const command of Object.values(commands)) {
				embed.addFields({
					name: command.data.name,
					value: command.data.description,
				});
			}
		}
		await interaction.reply({ embeds: [embed] });
	},
	autocomplete: async (interaction: AutocompleteInteraction) => {},
});
