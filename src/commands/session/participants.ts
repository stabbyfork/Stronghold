import { Op, sql } from '@sequelize/core';
import { ChatInputCommandInteraction, EmbedBuilder, userMention } from 'discord.js';
import ms from 'ms';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { SessionParticipant, SessionParticipantAssociations } from '../../models/sessionParticipant.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { SessionParticipantsOptions } from '../session.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.participants) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const session = await Data.models.GuildSession.findOne({
		where: { guildId: guild.id },
	});
	if (!session || !session.active) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingSession]), true);
		return;
	}

	const typeOfParticipants = getOption(interaction, args, 'type');
	let participants: SessionParticipant[];
	switch (typeOfParticipants) {
		case SessionParticipantsOptions.AllParticipants:
			participants = await session.getParticipants({ include: [SessionParticipantAssociations.User] });
			break;
		case SessionParticipantsOptions.CurrentlyInSession:
			participants = await session.getParticipants({
				where: { inSession: true },
				include: [SessionParticipantAssociations.User],
			});
			break;
		case SessionParticipantsOptions.MetTimeQuota:
			participants = await session.getParticipants({ include: [SessionParticipantAssociations.User] });
			// Don't do unnecessary checks
			if (session.timeQuota !== 0) {
				participants = participants.filter(
					(p) => p.timeSpent + (p.inSession ? Date.now() - p.joinedAt!.getTime() : 0) >= session.timeQuota,
				);
			}
			break;
		default:
			await reportErrorToUser(
				interaction,
				constructError(
					[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
					'Invalid participant type for participant retrieval, got ' + typeOfParticipants,
				),
				true,
			);
			return;
	}

	if (participants.length === 0) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Participants')
					.setColor('Red')
					.setDescription(
						'Nobody matches the criteria.' +
							(typeOfParticipants === SessionParticipantsOptions.MetTimeQuota
								? `\nThe time quota is ${ms(session.timeQuota, { long: true })}.`
								: ''),
					),
			],
		});
		return;
	}
	let toReply: EmbedBuilder;
	switch (typeOfParticipants) {
		case SessionParticipantsOptions.CurrentlyInSession:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users are currently in the session: ${participants.map((u) => userMention(u.user!.userId)).join(', ')}`,
				);
			break;
		case SessionParticipantsOptions.MetTimeQuota:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users have met the time quota (${ms(session.timeQuota, { long: false })}): ${participants.map((u) => userMention(u.user!.userId)).join(', ')}`,
				);
			break;
		case SessionParticipantsOptions.AllParticipants:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users have joined the session (at least once): ${participants.map((u) => userMention(u.user!.userId)).join(', ')}`,
				);
			break;
		default:
			await reportErrorToUser(
				interaction,
				constructError(
					[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
					'Invalid participant type for reply, got ' + typeOfParticipants,
				),
				true,
			);
			return;
	}

	await interaction.reply({
		embeds: [toReply],
		allowedMentions: { roles: [], users: [] },
	});
};
