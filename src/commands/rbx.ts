import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';

export default createCommand<{}, 'rbx'>({
	data: new SlashCommandBuilder()
		.setName('rbx')
		.setDescription('Commands related to Roblox integration and users.')
		.setContexts(InteractionContextType.Guild)
		.addSubcommandGroup((group) =>
			group
				.setName('blacklist')
				.setDescription('Commands related to the Roblox user blacklist')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add a Roblox user to the blacklist')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('Username to add')
								.setRequired(true)
								.setMinLength(1)
								.setMaxLength(50),
						)
						.addStringOption((option) =>
							option
								.setName('reason')
								.setDescription('Reason for adding the user to the blacklist')
								.setRequired(false)
								.setMinLength(1)
								.setMaxLength(128),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove a Roblox user from the blacklist')
						.addStringOption((option) =>
							option.setName('name').setDescription('Username to remove').setRequired(true),
						),
				)
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all users in the blacklist'))
				.addSubcommand((cmd) =>
					cmd.setName('clear').setDescription('Clear the user blacklist. Server owner only'),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('check')
						.setDescription('Find one or more Roblox users in the blacklist')
						.addStringOption((option) =>
							option.setName('names').setDescription('Usernames to find').setRequired(true),
						),
				),
		),
	limits: {
		blacklist: {
			add: {
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
				intervalMs: 0,
				usesPerInterval: 1,
			},
			remove: {
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
				intervalMs: 0,
				usesPerInterval: 1,
			},
			list: {
				useCooldown: 4 * 1000,
				scope: UsageScope.GuildMember,
				intervalMs: 30 * 1000,
				usesPerInterval: 3,
			},
			clear: {
				useCooldown: 2 * 1000,
				scope: UsageScope.GuildAll,
				intervalMs: 15 * 1000,
				usesPerInterval: 3,
			},
			check: {
				useCooldown: 4 * 1000,
				scope: UsageScope.GuildMember,
				intervalMs: 20 * 1000,
				usesPerInterval: 4,
			},
		},
	},
});
