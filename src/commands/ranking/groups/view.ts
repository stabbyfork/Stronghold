import { ChatInputCommandInteraction, ContainerBuilder, roleMention, TextDisplayBuilder } from 'discord.js';
import { Data } from '../../../data.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed, Pages } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.view) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const groupName = getOption(interaction, args, 'group_name');
	if (!groupName) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GroupNameEmpty]), true);
		return;
	}
	const group = await Data.models.RoleGroup.findOne({
		where: { guildId: guild.id, name: groupName },
		include: [RoleGroupAssociations.Roles],
	});
	if (!group) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` does not exist.`, true);
		return;
	}
	const roleMentions = group.roles!.map((role) => roleMention(role.roleId)).join('\n') ?? 'None.';
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setDescription(`**Roles:**\n${roleMentions}`)
				.setTitle(`Role group: ${group.name}`)
				.setColor('Green'),
		],
		allowedMentions: { users: [], roles: [] },
	});
};
