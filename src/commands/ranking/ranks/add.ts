import { Op } from '@sequelize/core';
import { ChatInputCommandInteraction, GuildMember, MessageFlags, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { Rank } from '../../../models/rank.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.add) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
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
	if (!(await hasPermissions(member, guild, true, Permission.ManageRanks))) return;
	const name = getOption(interaction, args, 'name');
	const pointsReq = getOption(interaction, args, 'points');
	const limit = getOption(interaction, args, 'limit') ?? -1;
	const existing = getOption(interaction, args, 'existing_role');
	const stack = getOption(interaction, args, 'stackable') ?? false;
	const showInRanking = getOption(interaction, args, 'show_in_ranking') ?? true;
	if (!existing && !name) {
		await interaction.reply({
			embeds: [
				defaultEmbed().setTitle('Error').setDescription('You must either provide a name OR an existing role.'),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
	if (existing && name) {
		await guild.roles.edit(existing, {
			name,
			reason: `Renamed by /ranking ranks add, supplied with both an existing role and name. By: ${interaction.user.id}`,
		});
	}
	if (limit !== -1 && stack) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.CantBeStackableAndLimited]), true);
		return;
	}
	if (
		(await Data.models.Rank.findOne({ where: { guildId: guild.id, name: name ? name : existing!.name } })) ||
		(existing && (await Data.models.Rank.findOne({ where: { guildId: guild.id, roleId: existing.id } })))
	) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.RankExistsSubstitute], name ?? existing!.name),
			true,
		);
		return;
	}

	const roleId = existing
		? existing.id
		: (
				await guild.roles.create({
					name: name!,
					permissions: [],
					hoist: true,
					reason: 'Created by /ranking ranks add. By: ' + interaction.user.id,
				})
			).id;
	let createdRank: Rank | null = null;
	await Data.mainDb.transaction(async (transaction) => {
		try {
			createdRank = await Data.models.Rank.create(
				{
					guildId: guild.id,
					name: name ?? existing!.name,
					pointsRequired: pointsReq,
					userLimit: limit,
					stackable: stack,
					roleId,
					showInRanking,
				},
				{
					transaction,
				},
			);
		} catch (e) {
			if (!existing) {
				await guild.roles.delete(roleId);
			}
			throw e;
		}
		for (const usr of await Data.models.User.findAll({
			where: { guildId: guild.id, [Op.or]: [{ mainRankId: null }, { points: { [Op.gte]: pointsReq } }] },
			transaction,
		})) {
			await Data.promoteUser(usr, transaction);
		}
	});
	if (!createdRank) {
		throw new Error('Failed to create rank');
	}

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Rank added')
				.setColor('Green')
				.setDescription(
					`Added rank ${roleMention((createdRank as Rank).roleId)} (${(createdRank as Rank).roleId}). You may change the role colour in the server's roles menu.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
	Logging.quickInfo(
		interaction,
		`Added rank ${roleMention((createdRank as Rank).roleId)} (${(createdRank as Rank).roleId}).`,
	);
};
