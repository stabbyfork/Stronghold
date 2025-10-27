import {
	AttachmentBuilder,
	ChatInputCommandInteraction,
	ContainerBuilder,
	SectionBuilder,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { Data } from '../../data.js';
import { getAttachment, listGuilds, Pages } from '../../utils/discordUtils.js';
import { Op } from '@sequelize/core';
import { client } from '../../client.js';
import _ from 'lodash';
import { reportErrorToUser } from '../../utils/errorsUtils.js';
import { AssetId, Assets } from '../../utils/assets.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const pages = new Pages({
		itemsPerPage: 5,
		files: [new AttachmentBuilder(Assets.getById(AssetId.DefaultGuildIcon), { name: AssetId.DefaultGuildIcon })],
		createPage: async (index, perPage, files) => {
			const start = index * perPage;
			const targets = await Data.models.Guild.findAll({
				offset: start,
				limit: perPage,
				order: [['createdAt', 'DESC']],
				where: {
					tag: { [Op.ne]: null },
				},
				attributes: ['guildId', 'tag', 'createdAt'],
			});
			return listGuilds(targets, files[0]);
		},
	});
	if (!(await Data.models.Guild.findOne())) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	await pages.replyTo(interaction, false, [0]);
};
