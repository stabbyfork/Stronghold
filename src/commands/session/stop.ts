import {
	channelMention,
	ChatInputCommandInteraction,
	GuildMember,
	MessageFlags,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import ms from 'ms';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { GuildFlag } from '../../utils/guildFlagsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { GuildAssociations } from '../../models/guild.js';
import { GuildSessionAssociations } from '../../models/session.js';
import { join } from 'path';

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
		include: [GuildSessionAssociations.TotalUsers],
	});
	if (!session) {
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
		const message = await channel.messages.fetch(session.sessionMessageId);
		if (!message) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.MessageNotFoundSubstitute]), true);
			return;
		}
		endTime = new Date();
		const startTime = session.startedAt;
		const embed = defaultEmbed()
			.setTitle('Session ended')
			.setColor('Red')
			.setDescription(`This session has ended.`);
		if (startTime) {
			embed.addFields(
				{ name: 'Started', value: `${time(startTime, TimestampStyles.RelativeTime)}`, inline: true },
				{ name: 'Ended', value: `${time(endTime, TimestampStyles.RelativeTime)}`, inline: true },
				{
					name: 'Duration',
					value: `${ms(endTime.getTime() - startTime.getTime(), { long: true })}`,
					inline: true,
				},
				/*{
					name: 'Participants',
					value: `${}`,
					inline: true,
				}*/
			);
		}
		const dbGuild = await Data.models.Guild.findOne({
			where: { guildId: guild.id },
		});
		const roleId = dbGuild?.inSessionRoleId;
		if (roleId) {
			const joinedSession = await guild.roles.fetch(roleId, { force: true });
			if (!joinedSession) {
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
				return;
			}
			await Promise.all(
				joinedSession.members.map(async (m) => await m.roles.remove(joinedSession, 'Session ended')),
			);
		}
		const joinedSession = session.totalUsers;
		if (joinedSession) {
			embed.addFields({
				name: 'Participants',
				value: joinedSession.length > 0 ? joinedSession.map((m) => userMention(m.userId)).join(', ') : 'None',
				inline: true,
			});
		} else {
			Logging.log({
				data: interaction,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					userId: interaction.user.id,
					action: 'Session ended with no total users association',
					cause: 'Total users association not found',
					msg: `Could not find total users association for session`,
				},
				logType: Logging.Type.Warning,
			});
		}
		await message.reply({
			embeds: [embed],
			allowedMentions: { roles: [], users: [] },
		});
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
		await session.setTotalUsers([], { transaction });
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
};
