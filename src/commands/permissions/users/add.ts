import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { setPermissionsWithInteractionUsers } from './set.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.users.add) => {
	setPermissionsWithInteractionUsers({
		interaction,
		userIds: getOption(interaction, args, 'users'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (prevPerms, newPerms) => prevPerms | newPerms,
		createSuccessEmbed: (userIds, permissions) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					permissions.length === 0
						? 'No permissions added.'
						: `Granted ${permissions.map((perm) => `\`${perm}\``).join(', ')} to ${userIds.map(userMention).join(', ')} successfully.`,
				),
		logString: (userIds, permissions) =>
			`Granted ${permissions.map((perm) => `\`${perm}\``).join(', ')} to ${userIds.map(userMention).join(', ')}.`,
	});
};
