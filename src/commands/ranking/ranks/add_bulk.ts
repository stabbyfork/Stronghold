import { Op } from '@sequelize/core';
import { Ajv } from 'ajv';
import { ChatInputCommandInteraction, Colors, GuildMember, MessageFlags, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

const ajv = new Ajv();

interface RankData {
	name?: string;
	points: number;
	limit?: number;
	role_id?: string;
	color?: string;
}

const schema = {
	type: 'array',
	items: {
		type: 'object',
		required: ['points'],
		properties: {
			name: {
				type: 'string',
				description: 'The name of the rank, constrained to 100 characters',
				maxLength: 100,
			},
			points: {
				type: 'integer',
				description: 'The number of points required to get this rank, required to be specified',
			},
			limit: {
				type: 'integer',
				description:
					'The maximum number of people who can have this rank, optional (will default to -1, no limit)',
			},
			role_id: {
				type: 'string',
				description: 'The ID of the role to use instead of creating a new one',
			},
			color: {
				type: 'string',
				description: 'Color of the role in hex format (e.g. #ff002b) or name (e.g. "Red")',
			},
		},
		additionalProperties: false,
	},
} as const;

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.add_bulk) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.ManageRanks))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRanks),
			true,
		);
		return;
	}
	const file = getOption(interaction, args, 'data_file');
	const text = getOption(interaction, args, 'data_text');
	if (!file && !text) {
		await interaction.reply({
			embeds: [defaultEmbed().setTitle('Error').setDescription('You must provide either a file or text.')],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	let json = [] as RankData[];
	let textToParse = text;
	if (file) {
		if (!file.contentType?.includes('application/json') && !file.contentType?.includes('text/plain')) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.InvalidFileTypeSubstitute], '.json, .txt'),
				true,
			);
			return;
		}
		const data = await fetch(file.url);
		if (!data.ok) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.CouldNotFetch]), true);
			return;
		}
		textToParse = await data.text();
	}
	if (!textToParse) {
		throw new Errors.ThirdPartyError('Failed to get text from file');
	}

	try {
		json = JSON.parse(textToParse);
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e;
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.InvalidFileFormatSeeHelp, ErrorReplies.OnlySubstitute], e),
			true,
		);
		return;
	}

	if (!Array.isArray(json)) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.InvalidFileFormatSeeHelp, ErrorReplies.OnlySubstitute],
				'JSON provided is not an array.',
			),
			true,
		);
		return;
	}

	const validate = ajv.compile(schema);
	if (!validate(json)) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.InvalidFileFormatSeeHelp, ErrorReplies.PrefixWithError],
				validate.errors?.map((e) => e.message ?? '').join('\n'),
			),
			true,
		);
		return;
	}
	if (json.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one rank.', true);
		return;
	}
	let replyStr = 'Added:\n';
	json.sort((a, b) => a.points - b.points);
	await Data.mainDb
		.transaction(async (transaction) => {
			for (const rank of json) {
				rank.limit ??= -1;
				const existing = rank.role_id;
				const name = rank.name;
				if (!existing && !name) {
					await interaction.reply({
						embeds: [
							defaultEmbed()
								.setTitle('Error')
								.setDescription('You must provide either a role ID or a name.'),
						],
						flags: MessageFlags.Ephemeral,
					});
					throw new Errors.HandledError('Role ID nor name provided');
				}

				const color = rank.color as keyof typeof Colors | undefined | `#${string}`;
				if (color && !(color in Colors || color.match(/#[0-9a-f]{6}/i))) {
					await reportErrorToUser(
						interaction,
						constructError([ErrorReplies.InvalidColorSubstitute, ErrorReplies.SeeHelp], color),
						true,
					);
					throw new Errors.HandledError('Invalid color');
				}
				let role = existing
					? guild.roles.cache.get(existing)
					: await guild.roles.create({
							hoist: true,
							name: rank.name,
							permissions: [],
							reason: `Created by /ranking ranks add_bulk, by: ${interaction.user.id}`,

							color,
						});
				if (!role) {
					await reportErrorToUser(
						interaction,
						constructError([ErrorReplies.RoleNotFoundSubstitute], existing),
						true,
					);
					throw new Errors.HandledError('Role not found');
				}
				if (color) {
					await guild.roles.edit(role, {
						color,
						reason: `Recolored by /ranking ranks add_bulk, supplied with a color, by: ${interaction.user.id}`,
					});
				}
				if (existing && name) {
					await guild.roles.edit(existing, {
						name,
						reason: `Renamed by /ranking ranks add_bulk, supplied with both an existing role and name, by: ${interaction.user.id}`,
					});
				}
				await Data.models.Rank.create(
					{
						guildId: guild.id,
						name: name ?? role.name,
						pointsRequired: rank.points,
						userLimit: rank.limit,
						roleId: role.id,
					},
					{
						transaction,
					},
				);
				replyStr += `${roleMention(role.id)}: \`${rank.points}\` points, ${rank.limit !== -1 ? `limit: \`${rank.limit}\` users` : 'no limit'}\n`;
			}
			const minPointReq = Math.min(...json.map((rank) => rank.points));
			const usersToPromote = await Data.models.User.findAll({
				where: {
					guildId: guild.id,
					[Op.or]: [
						{
							points: {
								[Op.gte]: minPointReq,
							},
						},
						{
							nextRankId: null,
						},
					],
				},
				transaction,
			});
			for (const user of usersToPromote) {
				await Data.promoteUser(user, transaction);
			}
		})
		.catch(async (e) => {
			if (!(e instanceof Errors.HandledError)) throw e;
		});

	await interaction.followUp({
		embeds: [defaultEmbed().setTitle('Successfully added ranks').setDescription(replyStr).setColor('Green')],
	});
};
