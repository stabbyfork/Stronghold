import { SlashCommandBuilder } from 'discord.js';
import fuzzysort from 'fuzzysort';
import { createCommand } from '../types/commandTypes.js';
import { ProxyUtils } from '../utils/proxyUtils.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';
import { preparedCmdsArray } from './utility/help.js';

export default createCommand<{}, 'proxy'>({
	data: new SlashCommandBuilder()
		.setName('proxy')
		.setDescription('Create custom names for commands (proxies/aliases)')
		.addSubcommand((cmd) =>
			cmd
				.setName('add')
				.setDescription('Add a custom name for a command')
				.addStringOption((option) =>
					option
						.setName('target')
						.setDescription('Target command')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(32)
						.setAutocomplete(true),
				)
				.addStringOption((option) =>
					option
						.setName('proxy')
						.setDescription('Proxy command name (alias)')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(32),
				),
		)
		.addSubcommand((cmd) =>
			cmd
				.setName('remove')
				.setDescription('Remove a custom command name')
				.addStringOption((option) =>
					option.setName('proxy').setDescription('Custom name').setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((cmd) => cmd.setName('list').setDescription('List all custom command names (aliases)'))
		.addSubcommand((cmd) =>
			cmd.setName('clear').setDescription('Clear all custom command names. Server owner only'),
		),
	limits: {
		add: {
			intervalMs: 18 * 60 * 60 * 1000,
			usesPerInterval: 20,
			useCooldown: 10 * 1000,
			scope: UsageScope.GuildAll,
		},
		remove: {
			intervalMs: 18 * 60 * 60 * 1000,
			usesPerInterval: 20,
			useCooldown: 10 * 1000,
			scope: UsageScope.GuildAll,
		},
		list: {
			intervalMs: 20 * 1000,
			usesPerInterval: 3,
			useCooldown: 6 * 1000,
			scope: UsageScope.GuildMember,
		},
		clear: {
			intervalMs: 24 * 60 * 60 * 1000,
			usesPerInterval: 5,
			useCooldown: 10 * 1000,
			scope: UsageScope.GuildAll,
		},
	},
	autocomplete: {
		add: async (interaction) => {
			const input = interaction.options.getFocused().trim().toLowerCase();
			const matched = fuzzysort.go(input, preparedCmdsArray, { all: true, limit: 25, threshold: 0.5 });
			await interaction.respond(matched.map((x) => ({ name: x.target, value: x.target })));
		},
		remove: async (interaction) => {
			const guild = interaction.guild;
			if (!guild) return;
			const input = interaction.options.getFocused().trim().toLowerCase();
			const cached = await ProxyUtils.getInCache(guild.id);
			if (!cached) {
				await interaction.respond([]);
				return;
			}
			const matched = fuzzysort.go(
				input,
				cached.map((x) => x.name),
				{ all: true, limit: 25, threshold: 0.5 },
			);
			await interaction.respond(matched.map((x) => ({ name: x.target, value: x.target })));
		},
	},
});
