import {
	ChatInputCommandInteraction,
	ContainerBuilder,
	GuildMember,
	roleMention,
	TextDisplayBuilder,
} from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Data } from '../../../data.js';
import { Op } from '@sequelize/core';
import { Pages } from '../../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const prefixes = await Data.models.RoleData.findAndCountAll({
		where: {
			guildId: guild.id,
			prefix: {
				[Op.not]: null,
			},
		},
	});
	if (prefixes.count === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoPrefixesSet]), true);
		return;
	}
	const pages = new Pages({
		itemsPerPage: 10,
		totalItems: prefixes.count,
		createPage: async (pageIndex, itemsPerPage) => {
			const start = pageIndex * itemsPerPage;
			const end = start + itemsPerPage;
			const pagePrefixes = prefixes.rows.slice(start, end);
			return new ContainerBuilder().addTextDisplayComponents(
				pagePrefixes.map((rp) =>
					new TextDisplayBuilder().setContent(`**${roleMention(rp.roleId)}** - \`${rp.prefix!}\``),
				),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
