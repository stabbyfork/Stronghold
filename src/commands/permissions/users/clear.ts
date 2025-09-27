import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed, getOption } from '../../../utils.js';
import { setPermissionsWithInteractionUsers } from './set.js';

export default async (
	interaction: ChatInputCommandInteraction,
	args: typeof commandOptions.permissions.users.clear,
) => {
	setPermissionsWithInteractionUsers({
		interaction,
		userIds: getOption(interaction, args, 'users'),
		permissions: '',
		setPermFunc: () => 0,
		createSuccessEmbed: (userIds) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Cleared all (bot-specific) permissions from ${userIds.map(userMention).join(', ')} successfully.`,
				),
	});
};
