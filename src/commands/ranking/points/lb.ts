import { ChatInputCommandInteraction, ContainerBuilder, userMention } from 'discord.js';
import { constructError, defaultEmbed, Pages, reportErrorToUser } from '../../../utils.js';
import { ErrorReplies } from '../../../types.js';
import { Data } from '../../../data.js';
import { Op } from '@sequelize/core';
import { UserAssociations } from '../../../models/user.js';

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
			['rankId', 'ASC'],
		],
		include: [UserAssociations.Rank],
	});
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: data.count,
		cachePages: true,
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
									.map(
										(d) =>
											`${userMention(d.userId)}: \`${d.points}\` (\`${d.rank?.name ?? 'No rank'}\`) `,
									)
									.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
