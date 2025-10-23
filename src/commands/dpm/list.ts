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
import { getAttachment, Pages } from '../../utils/discordUtils.js';
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
			const guilds = await Promise.all(
				targets.map(async (a) => client.guilds.cache.get(a.guildId) ?? (await client.guilds.fetch(a.guildId))),
			);
			const out = new ContainerBuilder().addTextDisplayComponents((text) => text.setContent('## List of guilds'));
			if (!targets.length) {
				out.addTextDisplayComponents((text) => text.setContent('None on this page.'));
				return out;
			}
			out.addSectionComponents(
				_.zip(guilds, targets).map(([g, t]) => {
					if (!g || !t) throw new Error('Guild (or target) not found');
					const section = new SectionBuilder();
					const icon = g.iconURL();
					if (icon) section.setThumbnailAccessory((image) => image.setURL(icon).setDescription(g.name));
					else
						section.setThumbnailAccessory((image) =>
							image.setDescription(`Default guild icon for ${g.name}`).setURL(getAttachment(files, 0)),
						);
					section.addTextDisplayComponents(
						(text) =>
							text.setContent(
								`### ${g.name}\nTag: \`${t.tag}\` | Members: ${g.memberCount} | Owner: ${userMention(g.ownerId)}`,
							),
						(text) =>
							text.setContent(
								`-# ID: \`${g.id}\` | Created on: ${time(g.createdAt, TimestampStyles.LongDate)}`,
							),
					);
					return section;
				}),
			);
			return out;
		},
	});
	if (!(await Data.models.Guild.findOne())) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	await pages.replyTo(interaction, false, [0]);
};
