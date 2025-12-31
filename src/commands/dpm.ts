import { AutocompleteInteraction, ChannelType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';
import { Data } from '../data.js';
import fuzzysort from 'fuzzysort';
import { Guild } from '../models/guild.js';
import { Op } from '@sequelize/core';

const preparedTagCache = [] as Fuzzysort.Prepared[];
const preparedGameCache = [] as Fuzzysort.Prepared[];
const gameCache = new Set<string>();

async function autocompTag(interaction: AutocompleteInteraction) {
	const input = interaction.options.getFocused().trim().toLowerCase();
	const matched = fuzzysort.go(input, preparedTagCache, { all: true, limit: 25, threshold: 0.5 });
	await interaction.respond(matched.map((x) => ({ name: x.target, value: x.target })));
}

async function autocompGame(interaction: AutocompleteInteraction) {
	const input = interaction.options.getFocused().trim().toLowerCase();
	const matched = fuzzysort.go(input, preparedGameCache, { all: true, limit: 25, threshold: 0.3 });
	await interaction.respond(matched.map((x) => ({ name: x.target, value: x.target })));
}

export default createCommand<{}, 'dpm'>({
	once: async () => {
		Data.models.Guild.hooks.addListener('beforeUpdate', async (instance: Guild) => {
			if (instance.tag) preparedTagCache.splice(preparedTagCache.indexOf(fuzzysort.prepare(instance.tag)), 1);
		});
		Data.models.Guild.hooks.addListener('afterUpdate', async (instance: Guild) => {
			if (instance.tag) preparedTagCache.push(fuzzysort.prepare(instance.tag));
			if (instance.dpmGame) {
				if (!gameCache.has(instance.dpmGame)) {
					preparedGameCache.push(fuzzysort.prepare(instance.dpmGame));
					gameCache.add(instance.dpmGame);
				}
			}
		});
		Data.models.Guild.hooks.addListener('afterDestroy', async (instance: Guild) => {
			if (instance.tag) preparedTagCache.splice(preparedTagCache.indexOf(fuzzysort.prepare(instance.tag)), 1);
		});
		Data.models.Guild.findAll({
			where: { tag: { [Op.ne]: null } },
		}).then((guilds) =>
			guilds.forEach((guild) => {
				preparedTagCache.push(fuzzysort.prepare(guild.tag!));
				if (guild.dpmGame) {
					if (!gameCache.has(guild.dpmGame)) {
						preparedGameCache.push(fuzzysort.prepare(guild.dpmGame));
						gameCache.add(guild.dpmGame);
					}
				}
			}),
		);
	},
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
						.setMaxLength(100)
						.setAutocomplete(true),
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
						.setMinLength(2)
						.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
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
								.setMinLength(2)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all neutral guilds')),
		)
		.addSubcommand((cmd) =>
			cmd
				.setName('list')
				.setDescription('List all existing guilds')
				.addStringOption((option) =>
					option
						.setName('game')
						.setDescription('Game to show guilds for')
						.setRequired(false)
						.setMaxLength(100)
						.setAutocomplete(true),
				),
		)
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
						.setMinLength(2)
						.setAutocomplete(true),
				)
				.addStringOption((option) =>
					option.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(1024),
				),
		)
		.addSubcommand((cmd) =>
			cmd.setName('unsetup').setDescription('Remove diplomacy features and unlist this guild'),
		),
	limits: {
		setup: {
			usesPerInterval: 3,
			intervalMs: 3 * 60 * 1000,
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
	autocomplete: {
		send: autocompTag,
		info: autocompTag,
		allies: {
			add: autocompTag,
			remove: autocompTag,
		},
		enemies: {
			add: autocompTag,
			remove: autocompTag,
		},
		neutrals: {
			add: autocompTag,
			remove: autocompTag,
		},
		setup: autocompGame,
		list: autocompGame,
	},
});
