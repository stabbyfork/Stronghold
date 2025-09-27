import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { Permission, PermissionBits } from '../../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.roles.list) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const role = getOption(interaction, args, 'role');
	const permsNum =
		(await Data.models.RolePermission.findOne({ where: { guildId: guild.id, roleId: role.id } }))?.permissions ?? 0;
	let perms = [] as Permission[];
	for (const perm of Object.values(Permission)) {
		if (permsNum & PermissionBits[perm]) {
			perms.push(perm);
		}
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(`Permissions for '${role.name}'`)
				.setDescription(
					`Users with this role ${perms.length === 0 ? '**do not** have any bot permissions' : `have the bot permissions: ${perms.map((perm) => `\`${perm}\``).join(', ')}`}.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
};
