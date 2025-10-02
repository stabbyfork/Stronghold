import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

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
	const inst = await Data.models.ActivityCheck.findOne({ where: { guildId: guild.id } });
	if (!inst?.currentMessageId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingActivityCheck]), true);
		return;
	}
	const paused = inst.paused;
	if (paused) {
		const [affected] = await Data.models.ActivityCheck.update({ paused: false }, { where: { guildId: guild.id } });
		if (affected === 0) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.UnknownError, ErrorReplies.ReportToOwner]),
				true,
			);
			return;
		}
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Activity check resumed')
					.setColor('Green')
					.setDescription('The activity check has been resumed.'),
			],
		});
		Logging.quickInfo(interaction, 'Resumed the activity check.');
	} else {
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Activity check already running')
					.setColor('Red')
					.setDescription('The activity check is already running.'),
			],
		});
	}
};
