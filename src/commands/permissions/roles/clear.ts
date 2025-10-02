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
		permissions: '',
		setPermFunc: () => 0,
		createSuccessEmbed: (roles) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Cleared all (bot-specific) permissions from ${roles.map(roleMention).join(', ')} successfully.`,
				),
		logString: (roles) => `Cleared all (bot-specific) permissions from ${roles.map(roleMention).join(', ')}.`,
	});
};
