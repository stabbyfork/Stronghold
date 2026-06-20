import { Op } from 'sequelize';
import { ChatInputCommandInteraction, EmbedBuilder, userMention } from 'discord.js';
import ms from 'ms';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { SessionParticipant, SessionParticipantAssociations } from '../../models/sessionParticipant.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { SessionParticipantsOptions, SessionParticipantsOutputTypes } from '../session.js';

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
	if (!session) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoSessionMade]), true);
		return;
	}
	const typeOfParticipants = getOption(interaction, args, 'type');
	const displayType = getOption(interaction, args, 'display_type');
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
				participants = participants.filter((p) => p.totalTimeSpent >= session.timeQuota);
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
	let participantMapper: (u: SessionParticipant) => string;
	const nameCache = new Map<string, string>();
	if (displayType === SessionParticipantsOutputTypes.Name) {
		// Get all participants now to avoid Promises
		await Promise.all(
			participants.map(async (p) => {
				if (!p.user) return;
				const id = p.user.userId;
				if (nameCache.has(id)) return;
				try {
					const member = await guild.members.fetch(id);
					nameCache.set(id, member.displayName);
				} catch {
					nameCache.set(id, `Unknown user (${id})`);
				}
			}),
		);
	}

	switch (displayType ?? SessionParticipantsOutputTypes.Mention) {
		case SessionParticipantsOutputTypes.Mention:
			participantMapper = (u) => userMention(u.user!.userId);
			break;
		case SessionParticipantsOutputTypes.Name:
			participantMapper = (u) => nameCache.get(u.user!.userId) || `Unknown user (${u.user!.userId})`;
			break;
		case SessionParticipantsOutputTypes.UserId:
			participantMapper = (u) => u.user!.userId;
			break;
		default:
			await reportErrorToUser(
				interaction,
				constructError(
					[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
					'Invalid participant type for display, got ' + displayType,
				),
				true,
			);
			return;
	}
	switch (typeOfParticipants) {
		case SessionParticipantsOptions.CurrentlyInSession:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users are currently in the session: ${participants.map(participantMapper).join(', ')}`,
				);
			break;
		case SessionParticipantsOptions.MetTimeQuota:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users have met the time quota (${ms(session.timeQuota, { long: false })}): ${participants.map(participantMapper).join(', ')}`,
				);
			break;
		case SessionParticipantsOptions.AllParticipants:
			toReply = defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					`The following users have joined the session (at least once): ${participants.map(participantMapper).join(', ')}`,
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
