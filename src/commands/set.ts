import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';

export default createCommand<{}, 'set'>({
	data: new SlashCommandBuilder()
		.setName('set')
		.setDescription('Configure various server-specific bot settings')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('bot_pfp')
				.setDescription("Set the bot's profile picture for this server. Omit to reset")
				.addAttachmentOption((option) =>
					option
						.setName('image')
						.setDescription('The image to set as the bot profile picture. Leave empty to reset')
						.setRequired(false),
				),
		),
	limits: {
		bot_pfp: {
			intervalMs: 2 * 60 * 1000,
			usesPerInterval: 1,
			useCooldown: 2 * 60 * 1000,
			scope: UsageScope.GuildAll,
		},
	},
});
