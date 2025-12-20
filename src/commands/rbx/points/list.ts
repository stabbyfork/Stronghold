import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { defaultEmbed, Pages } from '../../../utils/discordUtils.js';
import { Data } from '../../../data.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { Op } from '@sequelize/core';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const nPoints = await Data.models.RobloxUser.count({ where: { guildId: guild.id, points: { [Op.ne]: 0 } } });
	if (nPoints === 0) {
		await interaction.reply({
			embeds: [
				defaultEmbed().setTitle('Point list is empty').setDescription('Nobody has any points.').setColor('Red'),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: nPoints,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			const users = await Data.models.RobloxUser.findAndCountAll({
				where: { guildId: guild.id, points: { [Op.ne]: 0 } },
				limit: perPage,
				offset: start,
				attributes: ['userId', 'points'],
				order: [['points', 'DESC']],
			});
			pages.setTotalItems(users.count);
			const processedUsers = (await Roblox.idsToData(...users.rows.map((u) => Number(u.userId)))).map((u) => ({
				...u,
				points: users.rows.find((b) => b.userId === u.id.toString())!.points,
			}));
			let i = start;
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## Point leaderboard (Roblox users)'),
				(text) =>
					text.setContent(
						processedUsers
							.map((u) => {
								i++;
								return `${i}. \`${u.displayName}\` (\`@${u.name}\`/\`${u.id}\`): \`${u.points}\``;
							})
							.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
