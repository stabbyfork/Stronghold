import { ChatInputCommandInteraction, GuildMember, roleMention, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError, Debug } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { canManageRoleGroup } from './create.js';
import { Logging } from '../../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageRoleGroups))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRoleGroups),
			true,
		);
		return;
	}
	const groupName = getOption(interaction, args, 'group_name');
	if (!groupName) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GroupNameEmpty]), true);
		return;
	}
	const group = await Data.models.RoleGroup.findOne({
		where: { guildId: guild.id, name: groupName },
		include: [RoleGroupAssociations.Roles],
	});
	if (!group) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` does not exist.`, true);
		return;
	}
	const user = getOption(interaction, args, 'user');
	const member = guild.members.cache.get(user.id) ?? (await guild.members.fetch(user).catch(() => null));
	if (!member) {
		await reportErrorToUser(interaction, `The specified user could not be found in this guild.`, true);
		return;
	}
	try {
		await member.roles.remove(
			group.roles!.map((r) => r.roleId),
			`Removing role group ${group.name} per /ranking groups remove command. Requested by: ${interaction.user.id}`,
		);
	} catch (error) {
		await reportErrorToUser(
			interaction,
			`Failed to remove roles from the user. Please ensure the bot has the necessary permissions and role hierarchy to manage the user's roles.`,
			true,
		);
		Debug.error('Error removing roles for /ranking groups remove command:', error);
		return;
	}
	if (
		!(await canManageRoleGroup(
			interaction,
			guild,
			group.roles!.map((r) => r.roleId),
		))
	)
		return;

	await Data.mainDb.transaction(async (transaction) => {
		const [dbUser, created] = await Data.models.User.findCreateFind({
			where: {
				guildId: guild.id,
				userId: user.id,
			},
			defaults: { guildId: guild.id, userId: user.id },
			transaction,
		});
		if (!created && (await dbUser.hasRoleGroup(group))) {
			await dbUser.removeRoleGroup(group, { transaction });
		}
	});

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Role group removed from user')
				.setDescription(
					`Successfully removed the role group \`${groupName}\`, containing role${group.roles!.length !== 1 ? 's' : ''}: ${group
						.roles!.map((r) => roleMention(r.roleId))
						.join(', ')} from ${userMention(user.id)}.`,
				)
				.setColor('Green'),
		],
		allowedMentions: { users: [], roles: [] },
	});
	Logging.quickInfo(interaction, `Removed role group \`${groupName}\` from user ${userMention(user.id)}.`);
};
