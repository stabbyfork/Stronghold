import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';

export default createCommand<{}, 'dpm'>({
	data: new SlashCommandBuilder()
		.setName('dpm')
		.setDescription('Commands related to diplomacy')
		.addSubcommand((cmd) =>
			cmd
				.setName('setup')
				.setDescription('Setup diplomacy. Server owner only')
				.addStringOption((option) =>
					option
						.setName('tag')
						.setDescription('Unique tag to represent this guild. 2 to 8 chars, not case sensitive')
						.setRequired(true)
						.setMaxLength(8)
						.setMinLength(2),
				)
				.addChannelOption((option) =>
					option
						.setName('diplomacy_channel')
						.setDescription('Channel for diplomacy. Omit to create one')
						.setRequired(false)
						.addChannelTypes(ChannelType.GuildForum),
				)
				.addStringOption((option) =>
					option
						.setName('game')
						.setDescription('Enter the name of the game the server is based on')
						.setRequired(false)
						.setMaxLength(100),
				)
				.addBooleanOption((option) =>
					option
						.setName('create_invite')
						.setDescription('Whether to display an invite link to the server publicly')
						.setRequired(false),
				),
		)
		.addSubcommand((cmd) =>
			cmd
				.setName('info')
				.setDescription('Get info about a guild')
				.addStringOption((option) =>
					option
						.setName('tag')
						.setDescription('Tag of the guild. Omit for own info')
						.setRequired(false)
						.setMaxLength(8)
						.setMinLength(2),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('allies')
				.setDescription('Manage alliances')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Send an alliance request to a guild')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Message to send to the guild')
								.setRequired(false)
								.setMaxLength(1024),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Break ties with an ally')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Message to send to the guild')
								.setRequired(false)
								.setMaxLength(1024),
						),
				)
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all allies')),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('enemies')
				.setDescription('Manage enemies')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Declare an enemy')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Message to send to the guild')
								.setRequired(false)
								.setMaxLength(1024),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Send a peace request to an enemy')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Message to send to the guild')
								.setRequired(false)
								.setMaxLength(1024),
						),
				)
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all enemies')),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('neutrals')
				.setDescription('Manage neutral guilds')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add a neutral guild')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Message to send to the guild')
								.setRequired(false)
								.setMaxLength(1024),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove a neutral guild')
						.addStringOption((option) =>
							option
								.setName('tag')
								.setDescription('Tag of the target guild')
								.setRequired(true)
								.setMaxLength(8)
								.setMinLength(2),
						),
				)
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all neutral guilds')),
		)
		.addSubcommand((cmd) => cmd.setName('list').setDescription('List all existing guilds'))
		.addSubcommand((cmd) =>
			cmd
				.setName('send')
				.setDescription('Send a message to a guild')
				.addStringOption((option) =>
					option
						.setName('tag')
						.setDescription('Tag of the target guild')
						.setRequired(true)
						.setMaxLength(8)
						.setMinLength(2),
				)
				.addStringOption((option) =>
					option.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(1024),
				),
		),
	limits: {
		setup: {
			usesPerInterval: 3,
			intervalMs: 60 * 1000,
			useCooldown: 0,
			scope: UsageScope.GuildMember,
		},
		info: {
			usesPerInterval: 3,
			intervalMs: 40 * 1000,
			useCooldown: 5 * 1000,
			scope: UsageScope.GuildMember,
		},
		list: {
			usesPerInterval: 3,
			intervalMs: 40 * 1000,
			useCooldown: 8 * 1000,
			scope: UsageScope.GuildAll,
		},
		allies: {
			add: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			remove: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			list: {
				usesPerInterval: 3,
				intervalMs: 40 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
		},
		enemies: {
			add: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			remove: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			list: {
				usesPerInterval: 3,
				intervalMs: 40 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
		},
		neutrals: {
			add: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			remove: {
				usesPerInterval: 3,
				intervalMs: 60 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
			list: {
				usesPerInterval: 3,
				intervalMs: 40 * 1000,
				useCooldown: 5 * 1000,
				scope: UsageScope.GuildMember,
			},
		},
	},
	description: {
		setup: 'Tags must not contain spaces or exclamation marks (!). Converted to lowercase internally, so capitalisation of letters does not matter.',
	},
});
