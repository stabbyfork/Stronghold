import { ChatInputCommandInteraction, GuildMember, userMention } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { GuildAssociations } from '../../models/guild.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { reportErrorIfNotSetup, getOption } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import ms from 'ms';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.time) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const dbGuild = await Data.models.Guild.findOne({
		where: { guildId: guild.id },
		include: [GuildAssociations.Session],
	});
	if (!dbGuild) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'Guild could not found in the database',
			),
			true,
		);
		return;
	}
	const session = dbGuild?.session;
	if (!session?.active) {
		await reportErrorToUser(interaction, ErrorReplies.NoExistingSession, true);
		return;
	}
	const userToCheck = getOption(interaction, args, 'user');
	const dbUser = await Data.models.User.findOne({
		where: { userId: userToCheck.id, guildId: guild.id },
	});
	if (!dbUser) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserHasNotJoinedSession]), true);
		return;
	}
	const dbParticipant = (await session.getParticipants({ where: { userId: dbUser.id, sessionId: session.id } }))[0];
	// May be undefined if the user is not in the session
	if (!dbParticipant) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserHasNotJoinedSession]), true);
		return;
	}
	const timeSpent =
		dbParticipant.timeSpent + (dbParticipant.inSession ? Date.now() - dbParticipant.joinedAt!.getTime() : 0);
	const passesQuota = timeSpent >= session.timeQuota;
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Time spent')
				.setDescription(
					`${userMention(userToCheck.id)} has spent ${ms(timeSpent, { long: true })} in this session.\nThey ${passesQuota ? '**have**' : '**have not**'} met the quota of ${ms(
						session.timeQuota,
						{
							long: true,
						},
					)}.`,
				)
				.setColor(passesQuota ? 'Green' : 'Red'),
		],
		allowedMentions: { roles: [], users: [] },
	});
};
