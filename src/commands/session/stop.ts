import {
	ActionRow,
	channelMention,
	ChatInputCommandInteraction,
	ComponentType,
	ContainerComponent,
	GuildMember,
	Message,
	MessageActionRowComponent,
	MessageFlags,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import ms from 'ms';
import { Data } from '../../data.js';
import { GuildSessionAssociations } from '../../models/session.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { GuildFlag } from '../../utils/guildFlagsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { client } from '../../client.js';
import { memoize } from 'lodash';
import { SessionParticipantAssociations } from '../../models/sessionParticipant.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageSessions))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageSessions),
			true,
		);
		return;
	}
	const session = await Data.models.GuildSession.findOne({
		where: { guildId: guild.id },
		include: [
			{
				model: Data.models.SessionParticipant,
				as: GuildSessionAssociations.Participants,
				include: [SessionParticipantAssociations.User],
			},
		],
	});
	if (!session || !session.active) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingSession]), true);
		return;
	}
	const channel = await interaction.guild.channels.fetch(session.channelId);
	if (!channel) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ChannelNotFoundSubstitute]), true);
		return;
	}
	if (!channel.isSendable()) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				`Channel must be a regular -text-based channel (${channelMention(session.channelId)}).`,
			),
			true,
		);
		return;
	}
	let endTime: Date | null = null;
	if (session.sessionMessageId) {
		let message: Message | undefined = undefined;
		try {
			message = await channel.messages.fetch({ message: session.sessionMessageId, force: true });
		} catch {
			await Logging.log({
				logType: Logging.Type.Warning,
				data: interaction,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					msg: `Could not find session message`,
					userId: interaction.user.id,
					action: 'Session ended',
					cause: `Session message with ID ${session.sessionMessageId} could not be found in channel ${channelMention(session.channelId)}`,
				},
			});
		}
		endTime = new Date();
		const startTime = session.startedAt;
		const embed = defaultEmbed()
			.setTitle('Session ended')
			.setColor('Red')
			.setDescription(`This session has ended.`);
		if (startTime) {
			embed.addFields(
				{ name: 'Started', value: `${time(startTime, TimestampStyles.ShortTime)}`, inline: true },
				{ name: 'Ended', value: `${time(endTime, TimestampStyles.ShortTime)}`, inline: true },
				{
					name: 'Duration',
					value: `${ms(endTime.getTime() - startTime.getTime(), { long: true })}`,
					inline: true,
				},
			);
		}
		const dbGuild = await Data.models.Guild.findOne({
			where: { guildId: guild.id },
		});
		const roleId = dbGuild?.inSessionRoleId;
		const participants = session.participants;
		if (participants) {
			embed.addFields({
				name: 'Participants',
				value:
					participants.length > 0
						? participants
								.map(
									(m) =>
										`${userMention(m.user!.userId)} (${ms(m.timeSpent + (m.inSession ? Date.now() - m.joinedAt!.getTime() : 0))})`,
								)
								.join(', ')
						: 'None',
				inline: true,
			});
		} else {
			await Logging.log({
				data: interaction,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					userId: interaction.user.id,
					action: 'Session ended with no participants association',
					cause: 'Participants association not found',
					msg: `Could not find participants association for session`,
				},
				logType: Logging.Type.Warning,
			});
		}
		if (roleId) {
			const joinedSession = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId));
			if (joinedSession) {
				if (participants) {
					const currentlyInSession = await Promise.all(
						participants
							.filter((m) => m.inSession)
							.map(
								async (m) =>
									guild.members.cache.get(m.user!.userId) ??
									(await guild.members.fetch(m.user!.userId)),
							),
					);
					try {
						await Promise.all(
							currentlyInSession.map(async (m) => await m.roles.remove(joinedSession, 'Session ended')),
						);
					} catch (e) {
						await reportErrorToUser(
							interaction,
							`Cannot remove In Session role from participants: \`${e}\`. Is the role below the bot's highest role?`,
							true,
						);
						return;
					}
				}
			} else {
				await Logging.log({
					data: interaction,
					extents: [GuildFlag.LogWarnings],
					formatData: {
						userId: interaction.user.id,
						action: 'Session ended with no in session role',
						cause: 'In session role not found',
						msg: `Could not find in session role`,
					},
					logType: Logging.Type.Warning,
				});
			}
		}
		if (message) {
			// Removes last component (action row for buttons)
			(message.components[0] as ContainerComponent).components.pop();
			await message.edit({
				components: [...message.components],
				allowedMentions: { roles: [], users: [] },
			});
			await message.reply({
				embeds: [embed],
				allowedMentions: { roles: [], users: [] },
			});
		} else {
			// In case the message was deleted or not found
			await channel.send({
				embeds: [embed],
				allowedMentions: { roles: [], users: [] },
			});
		}
	} else {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'No session message'),
			true,
		);
		return;
	}
	await Data.mainDb.transaction(async (transaction) => {
		await session.update({ endedAt: new Date(), sessionMessageId: null, active: false }, { transaction });
		await session.setParticipants([], { transaction, destroyPrevious: true });
		await Data.models.RobloxUser.update(
			{
				inSession: false,
			},
			{
				where: {
					guildId: guild.id,
					inSession: true,
				},
				transaction,
			},
		);
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Session stopped')
				.setColor('Green')
				.setDescription(
					`Stopped session and replied to message in ${channelMention(session.channelId)} successfully.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
	Logging.quickInfo(interaction, `Stopped session in ${channelMention(session.channelId)}`);
};
