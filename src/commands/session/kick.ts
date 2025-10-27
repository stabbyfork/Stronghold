import { ChatInputCommandInteraction, GuildMember, userMention } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { GuildAssociations } from '../../models/guild.js';
import { Logging } from '../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.kick) => {
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
	const userToKick = getOption(interaction, args, 'user');

	const dbUser = await Data.models.User.findOne({
		where: { userId: userToKick.id, guildId: guild.id },
	});
	if (!dbUser) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserHasNotJoinedSession]), true);
		return;
	}
	const participant = (await session.getParticipants({ where: { userId: dbUser.id, sessionId: session.id } }))[0];
	// May be undefined if the user is not in the session
	if (!participant?.inSession) {
		await reportErrorToUser(interaction, ErrorReplies.UserNotInSession, true);
		return;
	}
	const roleId = dbGuild.inSessionRoleId;
	if (!roleId) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'Guild does not have in session role',
			),
			true,
		);
		return;
	}
	const inSessionRole = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId));
	if (!inSessionRole) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RoleNotFoundSubstitute], roleId));
		return;
	}

	const memberToKick = guild.members.cache.get(userToKick.id) ?? (await guild.members.fetch(userToKick.id));
	await Data.mainDb.transaction(async (transaction) => {
		await participant.update(
			{ inSession: false, timeSpent: Date.now() - participant.joinedAt!.getTime() },
			{ transaction },
		);
		await memberToKick.roles.remove(inSessionRole, 'Kicked from the session');
	});

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Success')
				.setColor('Green')
				.setDescription(`Kicked ${userMention(userToKick.id)} from the session.`),
		],
	});
	Logging.quickInfo(interaction, `Kicked ${userMention(userToKick.id)} from the session`);
};
