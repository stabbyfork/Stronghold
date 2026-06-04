import { ChatInputCommandInteraction, GuildMember, MessageFlags, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { Permission, PermissionBits } from '../../../utils/permissionsUtils.js';
import { UserAssociations } from '../../../models/user.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.users.list) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const user = getOption(interaction, args, 'user') ?? interaction.user;
	const dbUser = await Data.models.User.findOne({
		where: { guildId: guild.id, userId: user.id },
		include: [
			{
				association: UserAssociations.UserPermission,
				where: { guildId: guild.id },
				required: true,
			},
		],
	});
	const permsNum = dbUser?.userPermission?.permissions ?? 0;
	let perms = [] as Permission[];
	for (const perm of Object.values(Permission)) {
		if (permsNum & PermissionBits[perm]) {
			perms.push(perm);
		}
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(`Permissions for ${user.displayName} (@${user.username})`)
				.setDescription(
					`${userMention(user.id)} ${perms.length === 0 ? '**does not** have any bot permissions' : `has the following bot permissions: ${perms.map((perm) => `\`${perm}\``).join(', ')}`}.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
};
