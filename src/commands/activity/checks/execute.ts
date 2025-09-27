import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { ActivityCheckSequence, ActivityCheckEvent } from '../../../types/activityChecks.js';
import { runActivityCheckExecute, defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Usages, UsageEnum, UsageDefaults } from '../../../utils/usageLimitsUtils.js';

export default async (
	interaction: ChatInputCommandInteraction,
	args: typeof commandOptions.activity.checks.execute,
) => {
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
	const strSequence = getOption(interaction, args, 'override-sequence') ?? inst?.sequence;
	let sequence: ActivityCheckSequence;
	try {
		sequence = strSequence ? ActivityCheckSequence.fromString(strSequence) : ActivityCheckSequence.DEFAULT;
	} catch (e) {
		if (e instanceof Errors.ActivityCheckSequenceError) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.InvalidSequence]), true);
			return;
		}
		throw e;
	}
	if (sequence.getSequence().includes(ActivityCheckEvent.MessageInactive)) {
		const lim = Usages.guildAll(guild.id).getSetClone(UsageEnum.DMSend, UsageDefaults[UsageEnum.DMSend]);
		if (!lim.use()) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.DMSendLimitReachedSubstitute], lim.timeUntilNextUse()),
				true,
			);
			return;
		}
	}
	await runActivityCheckExecute(inst.guildId, inst.channelId, inst.currentMessageId, sequence.toString());
	await interaction.followUp({
		embeds: [
			defaultEmbed()
				.setTitle('Run complete')
				.setColor('Green')
				.setDescription(`Ran \`${sequence.prettyPrint().sequence}\`.`),
		],
		ephemeral: true,
	});
};
