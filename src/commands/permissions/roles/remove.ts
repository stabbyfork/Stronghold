import { ChatInputCommandInteraction, roleMention } from 'discord.js';
import { setPermissionsWithInteractionRoles } from './set.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

export default async (
	interaction: ChatInputCommandInteraction,
	args: typeof commandOptions.permissions.roles.remove,
) => {
	setPermissionsWithInteractionRoles({
		interaction,
		roleIds: getOption(interaction, args, 'roles'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (prevPerms, givenPerms) => prevPerms & ~givenPerms, // Bitwise removal (AND negate)
		createSuccessEmbed: (roles, permissions) =>
			defaultEmbed()
				.setTitle('Success')
				.setDescription(
					permissions.length === 0
						? 'No permissions removed.'
						: `Removed permission${permissions.length === 1 ? '' : 's'} ${permissions.map((perm) => `\`${perm}\``).join(', ')} from ${roles.map(roleMention).join(', ')} successfully.`,
				),
		logString: (roles, permissions) =>
			`Removed permission${permissions.length === 1 ? '' : 's'} ${permissions.map((perm) => `\`${perm}\``).join(', ')} from ${roles.map(roleMention).join(', ')}.`,
	});
};
