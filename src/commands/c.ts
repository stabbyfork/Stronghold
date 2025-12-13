import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';

export default createCommand<{}, 'c'>({
	data: new SlashCommandBuilder()
		.setName('c')
		.setDescription('Convenience commands: shortcuts to common commands and combinations')
		.addSubcommand((cmd) =>
			cmd
				.setName('bp')
				.setDescription('Check if blacklisted and in session; add points to roblox user')
				.addStringOption((option) =>
					option
						.setName('rbx_name')
						.setDescription('Roblox username to check and add points to')
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option
						.setName('points')
						.setDescription('Number of points to add (defaults to 1)')
						.setRequired(false),
				),
		),
	description: {
		bp: 'Checks if a Roblox user is blacklisted or in a session, then adds some number of points and marks them as in the session\nIf they are blacklisted or already in a session, the command fails.',
	},
});
