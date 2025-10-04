import { ChatInputCommandInteraction, ContainerBuilder, roleMention, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { Op } from '@sequelize/core';
import { UserAssociations } from '../../../models/user.js';
import { Pages } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const data = await Data.models.User.findAndCountAll({
		where: { guildId: guild.id, points: { [Op.gt]: 0 } },
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
										return `${ind === 1 ? '## ** **' : ind === 2 || ind === 3 ? '### ** ** ' : ''}${ind}. ${userMention(d.userId)}: \`${d.points}\` (${d.mainRank ? roleMention(d.mainRank.roleId) : '\`No rank\`'}) `;
									})
									.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
