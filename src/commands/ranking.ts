import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';

const exampleRankObjs = [
	{
		name: 'Example Rank 1',
		points: 100,
		limit: 10,
		role_id: '1234567890123456789',
		color: 'Green',
		stack: false,
	},
	{
		name: 'Example Rank 2',
		points: 50,
		role_id: '405856094017456712',
		color: '#ff002b',
		stack: true,
	},
] as const;

export default createCommand<{}, 'ranking'>({
	data: new SlashCommandBuilder()
		.setName('ranking')
		.setDescription('Commands related to ranks and points')
		.addSubcommand((cmd) =>
			cmd
				.setName('view')
				.setDescription('View rank details of a member (or yourself)')
				.addUserOption((option) =>
					option.setName('user').setDescription('User to see details of').setRequired(false),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('points')
				.setDescription('Points, given to users')
				.addSubcommand((cmd) =>
					cmd.setName('lb').setDescription('View the points leaderboard (for this server)'),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add points to a list of users')
						.addIntegerOption((option) =>
							option.setName('points').setDescription('Number of points to add').setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to add points to (mentions)')
								.setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove points from a list of users')
						.addIntegerOption((option) =>
							option.setName('points').setDescription('Number of points to remove').setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to remove points from (mentions)')
								.setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('set')
						.setDescription('Set the points of a list of users')
						.addIntegerOption((option) =>
							option.setName('points').setDescription('Number of points to set to').setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to set the points of (mentions)')
								.setRequired(true),
						),
				),
		)
		.addSubcommand((cmd) => cmd.setName('promote').setDescription('Promote everyone to an available rank'))
		.addSubcommandGroup((group) =>
			group
				.setName('ranks')
				.setDescription('Ranks, given to users based on their points')
				.addSubcommand((cmd) => cmd.setName('list').setDescription('List all available ranks'))
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add a rank to this server')
						.addIntegerOption((option) =>
							option
								.setName('points')
								.setDescription('Points required to get this rank')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('Name of the rank')
								.setRequired(false)
								.setMaxLength(100),
						)
						.addRoleOption((option) =>
							option
								.setName('existing_role')
								.setDescription('Role to use instead of creating a new one')
								.setRequired(false),
						)
						.addIntegerOption((option) =>
							option
								.setName('limit')
								.setDescription('Maximum number of users with this rank (default = no limit)'),
						)
						.addBooleanOption((option) =>
							option
								.setName('stackable')
								.setDescription('Whether this rank can be stacked with other ranks (default = false)')
								.setRequired(false),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('add_bulk')
						.setDescription('Add multiple ranks at once via JSON data. See help entry for info')
						.addStringOption((option) =>
							option.setName('data_text').setRequired(false).setDescription('JSON data as text'),
						)
						.addAttachmentOption((option) =>
							option.setRequired(false).setName('data_file').setDescription('JSON data as a file'),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('edit')
						.setDescription('Edit a rank. Only modifies specified fields')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('Current name of the rank')
								.setRequired(true)
								.setMaxLength(100),
						)
						.addStringOption((option) =>
							option.setName('new_name').setDescription('New name of the rank').setMaxLength(100),
						)
						.addIntegerOption((option) =>
							option.setName('points').setDescription('New points required to get this rank'),
						)
						.addIntegerOption((option) =>
							option
								.setName('limit')
								.setDescription('New maximum number of users with this rank (-1 = no limit)'),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove a rank by name')
						.addStringOption((option) =>
							option
								.setName('rank')
								.setDescription('Name of the rank to remove')
								.setRequired(true)
								.setMaxLength(100),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('in')
						.setDescription('Get a list of users in a rank')
						.addStringOption((option) =>
							option.setName('rank').setDescription('Name of the rank').setRequired(true),
						),
				),
		),
	description: {
		ranks: {
			add: 'If both a name and an existing role are given, the existing role will be renamed.\nIf only a name is given, a new role will be created.\nIf only an existing role is given, the name will be set to the name of the role.\nEnabling `stackable` means the role will be kept even if the user reaches the next rank.\nA user can have one non-stacking rank and unlimited stacking ranks.\nOne server can only have 100 ranks.',
			add_bulk: `The file must contain a valid [JSON](https://www.w3schools.com/Js/js_json_syntax.asp) array, in this format:\n\`\`\`json\n${JSON.stringify(exampleRankObjs, null, 4)}\n\`\`\`\n\`name\` is the name of the rank, and is constrained to 100 characters.\n\`points\` is the number of points required to get this rank, and is required to be specified.\n\`limit\` is the maximum number of people who can have this rank, and is optional (will default to no limit).\n\`role_id\` is the optional ID of the role to use instead of creating a new one.\nIf both \`name\` and \`role_id\` are given, the role and rank will be renamed to \`name\`. If only \`name\` is given, a new role will be created (with that name).\nIf only \`role_id\` is given, the name will be set to the name of the role.\n\`color\` can be the name of a color (e.g. "Red") or a hex number (e.g. "#ff0000").\n\`stack\` and \`limit\` are mutually exclusive; a stacking rank cannot have a user limit. Stacking ranks are also not considered to be main ranks, and will not be shown in point leaderboards.\n-# ||(too much effort to make it work)||\nA server can have a maximum of 100 ranks.`,
		},
	},
	limits: {
		points: {
			add: { usesPerInterval: 3, useCooldown: 10 * 1000, intervalMs: 45 * 1000 },
			set: { usesPerInterval: 3, useCooldown: 10 * 1000, intervalMs: 45 * 1000 },
			remove: { usesPerInterval: 3, useCooldown: 10 * 1000, intervalMs: 60 * 1000 },
		},
		ranks: {
			add: { usesPerInterval: 3, useCooldown: 10 * 1000, intervalMs: 60 * 1000 },
			edit: { usesPerInterval: 4, useCooldown: 12 * 1000, intervalMs: 60 * 1000 },
			list: { usesPerInterval: 3, useCooldown: 10 * 1000, intervalMs: 40 * 1000 },
			add_bulk: { usesPerInterval: 2, useCooldown: 15 * 1000, intervalMs: 120 * 1000 },
			in: { usesPerInterval: 4, useCooldown: 5 * 1000, intervalMs: 40 * 1000 },
		},
		promote: { usesPerInterval: 1, useCooldown: 0, intervalMs: 150 * 1000, scope: UsageScope.GuildAll },
	},
});
