import { ChatInputCommandInteraction, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { Data } from '../../../data.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Pages } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const roleGroups = await Data.models.RoleGroup.findAll({
		where: { guildId: guild.id },
		order: [['name', 'ASC']],
		include: [RoleGroupAssociations.Roles],
	});
	const pages = new Pages({
		itemsPerPage: 10,
		totalItems: roleGroups.length,
		createPage: async (pageIndex, itemsPerPage) => {
			const start = pageIndex * itemsPerPage;
			const end = start + itemsPerPage;
			const pageRoleGroups = roleGroups.slice(start, end);
			return new ContainerBuilder().addTextDisplayComponents(
				pageRoleGroups.map((rg) =>
					new TextDisplayBuilder().setContent(`**${rg.name}** - ${rg.roles!.length} role(s)`),
				),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
