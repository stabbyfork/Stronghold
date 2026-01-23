import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
};
