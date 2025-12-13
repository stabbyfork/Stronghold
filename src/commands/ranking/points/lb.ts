import { ChatInputCommandInteraction, ContainerBuilder, roleMention, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { Op } from '@sequelize/core';
import { User, UserAssociations } from '../../../models/user.js';
import { Pages } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { Rank } from '../../../models/rank.js';

function getHighestStackingRanks(user: User) {
	const ranks = user.ranks;
	if (!ranks) {
		throw new Error('User has no secondary ranks');
	}

	const highestP = ranks[0].pointsRequired;
	let highestRanks: Rank[] = [];
	for (const rank of ranks) {
		if (rank.pointsRequired === highestP) {
			highestRanks.push(rank);
		} else {
			break;
		}
	}
	return highestRanks;
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.points.lb) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const showStacking = getOption(interaction, args, 'show_stackable') ?? false;
	const data = showStacking
		? await Data.models.User.findAndCountAll({
				where: { guildId: guild.id, points: { [Op.ne]: 0 } },
				order: [
					['points', 'DESC'],
					[{ model: Data.models.Rank, as: UserAssociations.MainRank }, 'pointsRequired', 'DESC'],
				],
				include: [
					UserAssociations.MainRank,
					{
						model: Data.models.Rank,
						as: UserAssociations.SecondaryRanks,
						order: [['pointsRequired', 'DESC']],
						required: false,
						where: { showInRanking: true },
					},
				],
			})
		: await Data.models.User.findAndCountAll({
				where: { guildId: guild.id, points: { [Op.ne]: 0 } },
				order: [
					['points', 'DESC'],
					[{ model: Data.models.Rank, as: UserAssociations.MainRank }, 'pointsRequired', 'DESC'],
				],
				include: [UserAssociations.MainRank],
			});
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: data.count,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## Leaderboard'),
				(text) =>
					text.setContent(
						data.count === 0
							? 'No one has any points.'
							: data.rows
									.slice(start, start + perPage)
									.map((d, i) => {
										const ind = i + 1 + start;
										return `${ind === 1 ? '## ** **' : ind === 2 || ind === 3 ? '### ** ** ' : ''}${ind}. ${userMention(d.userId)}: \`${d.points}\` (${
											d.mainRank
												? roleMention(d.mainRank.roleId)
												: showStacking && d.ranks?.length
													? getHighestStackingRanks(d)
															.map((r) => roleMention(r.roleId))
															.join(', ')
													: '\`No rank\`'
										}) `;
									})
									.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
