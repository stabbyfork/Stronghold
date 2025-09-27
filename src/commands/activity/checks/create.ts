import { ChatInputCommandInteraction, EmojiIdentifierResolvable, GuildMember, MessageFlags } from 'discord.js';
import ms from 'ms';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { ActivityCheckSequence, ActivityCheckEvent } from '../../../types/activityChecks.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { strToDuration, intDiv } from '../../../utils/genericsUtils.js';
import { reportErrorIfNotSetup, getOption } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';

export function getDefaultActivityCheckEmoji(): string {
	return '✅';
}

export function createActivityCheckEmbed(emoji: EmojiIdentifierResolvable, maxStrikes = 3) {
	return {
		embeds: [
			defaultEmbed().setTitle('Activity check')
				.setDescription(`React with ${emoji} to be considered active. If you fail to react before reactions are counted, an inactivity strike\
					will be added and you will be marked as inactive. After ${maxStrikes} strike${maxStrikes === 1 ? '' : 's'}, you may be kicked.`),
		],
	};
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.activity.checks.create) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.ManageActivityChecks))) {
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
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const channel = getOption(interaction, args, 'channel');
	const maxStrikes = getOption(interaction, args, 'max-strikes') ?? 3;

	let sequence: ActivityCheckSequence;
	try {
		const opt = getOption(interaction, args, 'sequence');
		sequence = opt ? ActivityCheckSequence.fromString(opt) : ActivityCheckSequence.DEFAULT;
	} catch (e) {
		if (e instanceof Errors.ActivityCheckSequenceError) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.InvalidSequence]), true);
			return;
		}
		throw e;
	}

	const interval = getOption(interaction, args, 'interval');
	if (interval && sequence.getSequence().includes(ActivityCheckEvent.SendNextMessage)) {
		reportErrorToUser(interaction, constructError([ErrorReplies.IntervalWithoutSendNext]), true);
		return;
	}
	let durMs: number | null = null;
	if (interval !== null) {
		durMs = strToDuration(interval);
		if (durMs === null) {
			reportErrorToUser(interaction, constructError([ErrorReplies.InvalidTimeFormat]), true);
			return;
		}
		if (durMs < 1000 * 60 * 60) {
			reportErrorToUser(interaction, constructError([ErrorReplies.DurationTooShort]), true);
			return;
		}
		if (durMs > 1000 * 60 * 60 * 24 * 21) {
			reportErrorToUser(interaction, constructError([ErrorReplies.DurationTooLong]), true);
			return;
		}
	}

	const activityCheck = Data.models.ActivityCheck.build({
		guildId: guild.id,
		channelId: channel.id,
		sequence: sequence.toString(),
		interval: interval === null ? undefined : intDiv(durMs!, 1000),
		lastRun: intDiv(Date.now(), 1000),
		maxStrikes,
	});
	if (channel.isSendable()) {
		const msg = await channel.send(createActivityCheckEmbed(getDefaultActivityCheckEmoji(), maxStrikes));
		await msg.react(getDefaultActivityCheckEmoji());
		activityCheck.currentMessageId = msg.id;
	} else {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner]),
			true,
		);
	}
	await activityCheck.save();
	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Activity check started')
				.setDescription(
					`Activity check has been successfully created and started,\
					with sequence (to run) \`${sequence.prettyPrint().sequence}\`\
					${durMs === null ? '' : ` and an interval of \`${ms(durMs)}\``}`,
				),
		],
	});
};
