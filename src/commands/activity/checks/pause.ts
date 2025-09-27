import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	await interaction.deferReply();
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const usr = interaction.member as GuildMember | null;
	if (!usr) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(usr, guild, true, Permission.ManageActivityChecks))) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.PermissionError, ErrorReplies.PermissionsNeededSubstitute],
				Permission.ManageActivityChecks,
			),
			true,
		);
		return;
	}
	const inst = await Data.models.ActivityCheck.findOne({ where: { guildId: guild.id, paused: false } });
	if (!inst?.currentMessageId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingActivityCheck]), true);
		return;
	}
	await Data.models.ActivityCheck.update({ paused: true }, { where: { guildId: guild.id } });
	await interaction.followUp({
		embeds: [
			defaultEmbed()
				.setTitle('Paused')
				.setColor('Yellow')
				.setDescription('The current activity check has been paused.'),
		],
		ephemeral: true,
	});
};
