import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { setPermissionsWithInteractionUsers } from './set.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

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
