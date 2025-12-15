import { Op } from '@sequelize/core';
import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Data } from '../../data.js';
import { AssetId, Assets } from '../../utils/assets.js';
import { listGuilds, Pages } from '../../utils/discordUtils.js';
import { reportErrorToUser } from '../../utils/errorsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const nGuilds = await Data.models.Guild.count({
		where: {
			tag: { [Op.ne]: null },
		},
	});
	if (nGuilds === 0) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	const pages = new Pages({
		itemsPerPage: 5,
		totalItems: nGuilds,
		files: [new AttachmentBuilder(Assets.getById(AssetId.DefaultGuildIcon), { name: AssetId.DefaultGuildIcon })],
		createPage: async (index, perPage, files) => {
			const start = index * perPage;
			const targets = await Data.models.Guild.findAndCountAll({
				offset: start,
				limit: perPage,
				order: [['createdAt', 'DESC']],
				where: {
					tag: { [Op.ne]: null },
				},
				attributes: ['guildId', 'tag', 'serverInvite', 'dpmGame'],
			});
			pages.setTotalItems(targets.count);
			return listGuilds(targets.rows, files[0]);
		},
	});
	if (!(await Data.models.Guild.findOne())) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	await pages.replyTo(interaction, false, [0]);
};
