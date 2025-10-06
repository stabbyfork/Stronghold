import { ChatInputCommandInteraction, ContainerBuilder, roleMention, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { Op } from '@sequelize/core';
import { User, UserAssociations } from '../../../models/user.js';
import { Pages } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

async function getHighestStackingRank(user: User) {
	const ranks = user.ranks ?? (await user.getRanks());

	let highestRank = ranks[0];
	for (const rank of ranks) {
		if (rank.pointsRequired > highestRank.pointsRequired) {
			highestRank = rank;
		}
	}
	return highestRank;
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.points.lb) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const showStacking = getOption(interaction, args, 'show_stackable') ?? false;
	const data = showStacking
		? await Data.models.User.findAndCountAll({
				where: { guildId: guild.id, points: { [Op.ne]: 0 } },
				order: [
					['points', 'DESC'],
					[{ model: Data.models.Rank, as: UserAssociations.MainRank }, 'pointsRequired', 'DESC'],
				],
				include: [UserAssociations.MainRank, UserAssociations.SecondaryRanks],
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
									.map(async (d, i) => {
										const ind = i + 1 + start;
										return `${ind === 1 ? '## ** ** ' : ind === 2 || ind === 3 ? '### ** ** ' : ''}${ind}. ${userMention(d.userId)}: \`${d.points}\` (${d.mainRank ? roleMention(d.mainRank.roleId) : showStacking ? ((await getHighestStackingRank(d)) ?? '\`No rank\`') : '\`No rank\`'}) `;
									})
									.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
