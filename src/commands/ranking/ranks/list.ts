import { ChatInputCommandInteraction, ContainerBuilder, roleMention } from 'discord.js';
import { constructError, Pages, reportErrorIfNotSetup, reportErrorToUser } from '../../../utils.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types.js';
import { RankAssociations } from '../../../models/rank.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const ranks = await Data.models.Rank.findAndCountAll({
		where: { guildId: guild.id },
		order: [['pointsRequired', 'DESC']],
		include: [RankAssociations.RankUsage],
	});
	if (ranks.count === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoRanks]), true);
		return;
	}
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: ranks.count,
		cachePages: true,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of ranks'),
				(text) =>
					text.setContent(
						ranks.rows
							.slice(start, start + perPage)
							.map(
								(rank) =>
									`${roleMention(rank.roleId)}: \`${rank.pointsRequired}\` points, ${rank.userLimit === -1 ? 'no limit' : `\`${rank.rankUsage?.userCount ?? 0}\` out of \`${rank.userLimit}\` user(s)`}`,
							)
							.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
