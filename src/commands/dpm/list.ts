import { ChatInputCommandInteraction, ContainerBuilder } from 'discord.js';
import { Data } from '../../data.js';
import { Pages } from '../../utils/discordUtils.js';
import { Op } from '@sequelize/core';

export default async (interaction: ChatInputCommandInteraction) => {
	const pages = new Pages({
		itemsPerPage: 30,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			const targets = await Data.models.Guild.findAll({
				offset: start,
				limit: perPage,
				order: [['createdAt', 'DESC']],
				where: {
					tag: { [Op.ne]: null },
				},
			});
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of guilds'),
				(text) =>
					text.setContent(
						targets.length ? targets.map((a) => `\`${a.tag}\``).join('\n') : 'None on this page.',
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
