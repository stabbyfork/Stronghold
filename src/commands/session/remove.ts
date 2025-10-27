import { ChatInputCommandInteraction, GuildMember, MessageFlags, userMention } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { GuildAssociations } from '../../models/guild.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.remove) => {
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
	const userToRemove = getOption(interaction, args, 'user');
	const dbUser = await Data.models.User.findOne({
		where: { userId: userToRemove.id, guildId: guild.id },
	});
	if (!dbUser) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.UserNotFoundSubstitute], userToRemove.id),
			true,
		);
		return;
	}
	const dbParticipant = (await session.getParticipants({ where: { userId: dbUser.id, sessionId: session.id } }))[0];
	// May be undefined if the user is not in the session
	if (!dbParticipant?.inSession) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserNotInSession], userToRemove.id), true);
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

	const memberToRemove = guild.members.cache.get(userToRemove.id) ?? (await guild.members.fetch(userToRemove.id));
	await Data.mainDb.transaction(async (transaction) => {
		await memberToRemove.roles.remove(inSessionRole, 'Removed from the session');
		await session.removeParticipant(dbParticipant.id, { transaction, destroy: true });
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Success')
				.setDescription(`Removed ${userMention(userToRemove.id)} from the session.`)
				.setColor('Green'),
		],
	});
};
