import { ChatInputCommandInteraction, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { setPermissionsWithInteractionRoles } from './set.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.roles.add) => {
	setPermissionsWithInteractionRoles({
		interaction,
		roleIds: getOption(interaction, args, 'roles'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (prevPerms, newPerms) => prevPerms | newPerms,
		createSuccessEmbed: (roles, permissions) =>
			defaultEmbed()
				.setTitle('Success')
				.setDescription(
					permissions.length === 0
						? 'No permissions added.'
						: `Added permission${permissions.length === 1 ? '' : 's'} ${permissions.map((perm) => `\`${perm}\``).join(', ')} to ${roles.map(roleMention).join(', ')} successfully.`,
				),
	});
};
