import { ChatInputCommandInteraction, ContainerBuilder, GuildMember } from 'discord.js';
import { isDiploReady } from '../../../utils/diplomacyUtils.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Pages } from '../../../utils/discordUtils.js';
import { Data } from '../../../data.js';
import { GuildRelation, RelatedGuildAssociations } from '../../../models/relatedGuild.js';
import { Op } from '@sequelize/core';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await isDiploReady(interaction.guild))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.DiploNotSetup]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.ManageRelations))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRelations),
			true,
		);
		return;
	}
	const allies = await Data.models.RelatedGuild.findAndCountAll({
		where: {
			relation: GuildRelation.Ally,
			guildId: guild.id,
		},
		include: [{ model: Data.models.Guild, as: RelatedGuildAssociations.TargetGuild, attributes: ['tag'] }],
		distinct: true,
	});
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: allies.count,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of allies'),
				(text) =>
					text.setContent(
						allies.count
							? allies.rows
									.slice(start, start + perPage)
									.map((a) =>
										a.targetGuild
											? `\`${a.targetGuild.tag}\``
											: `Unknown guild \`${a.targetGuildId}\``,
									)
									.join('\n')
							: 'No allies exist.',
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
