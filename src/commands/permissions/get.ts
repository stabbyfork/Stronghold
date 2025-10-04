import { ChatInputCommandInteraction, GuildMember, MessageFlags, userMention } from 'discord.js';
import { ErrorReplies } from '../../types/errors.js';
import { Data } from '../../data.js';
import { commandOptions } from '../../cmdOptions.js';
import { UserAssociations } from '../../models/user.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { Permission, PermissionBits } from '../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.get) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const suppliedUser = getOption(interaction, args, 'user');
	const member = suppliedUser ? guild.members.cache.get(suppliedUser.id) : (interaction.member as GuildMember);
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	let accPerms = 0;
	const dbUser = await Data.models.User.findOne({
		where: { guildId: guild.id, userId: member.id },
		include: [{ association: UserAssociations.UserPermission, where: { guildId: guild.id } }],
	});
	const userPerms = dbUser?.userPermission;
	if (userPerms) accPerms |= userPerms.permissions;
	for (const role of await Data.models.RolePermission.findAll({ where: { guildId: guild.id } })) {
		if (!member.roles.cache.has(role.roleId)) continue;
		accPerms |= role.permissions;
	}

	const permsString = Object.values(Permission)
		.filter((perm) => accPerms & PermissionBits[perm])
		.map((perm) => `\`${perm}\``)
		.join(', ');
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(suppliedUser ? `${suppliedUser.username}'s permissions` : 'Your permissions')
				.setDescription(
					`${suppliedUser ? `${userMention(suppliedUser.id)}'s` : 'Your'} bot permissions, including permissions given by roles, are: ${permsString ? permsString : 'none'}.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
};
