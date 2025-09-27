import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { setPermissionsWithInteractionUsers } from './set.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed, getOption } from '../../../utils.js';

export default async (
	interaction: ChatInputCommandInteraction,
	args: typeof commandOptions.permissions.users.remove,
) => {
	setPermissionsWithInteractionUsers({
		interaction,
		userIds: getOption(interaction, args, 'users'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (prevPerms, givenPerms) => prevPerms & ~givenPerms,
		createSuccessEmbed: (users, permissions) =>
			defaultEmbed()
				.setTitle('Success')
				.setDescription(
					permissions.length === 0
						? `No permissions removed from ${users.join(', ')}`
						: `Removed ${permissions.map((perm) => `\`${perm}\``).join(', ')} from ${users.map(userMention).join(', ')}`,
				)
				.setColor('Green'),
	});
};
