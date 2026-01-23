import { ChatInputCommandInteraction, GuildMember, roleMention, userMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { canManageRoleGroup } from './create.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.add) => {
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
	const roleGroup = await Data.models.RoleGroup.findOne({
		where: {
			guildId: guild.id,
			name: groupName,
		},
		include: [RoleGroupAssociations.Roles],
	});
	if (!roleGroup) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` does not exist.`, true);
		return;
	}
	const user = getOption(interaction, args, 'user');
	const member = guild.members.cache.get(user.id) ?? (await guild.members.fetch(user.id).catch(() => null));
	if (!member) {
		await reportErrorToUser(
			interaction,
			`The specified user (${userMention(user.id)}) is not a member of this guild, or could not be found as a member.`,
			true,
		);
		return;
	}
	const roleIds = roleGroup.roles!.map((roleData) => roleData.roleId);
	if (!(await canManageRoleGroup(interaction, guild, roleIds))) return;
	await Data.mainDb.transaction(async (transaction) => {
		const [dbUser] = await Data.models.User.findCreateFind({
			where: {
				guildId: guild.id,
				userId: user.id,
			},
			transaction,
		});
		await dbUser.addRoleGroup(roleGroup, { transaction });
		try {
			await member.roles.add(
				roleIds,
				`Adding role group ${groupName} per /ranking groups add command. Requested by: ${interaction.user.id}`,
			);
		} catch (error) {
			await reportErrorToUser(
				interaction,
				`Failed to add roles: ${roleIds.map(roleMention).join(', ')} to user ${userMention(user.id)}. Please ensure the bot has the necessary permissions and the roles are assignable.`,
				true,
			);
			throw error; // Re-throw to rollback transaction if needed
		}
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Role group added to user')
				.setDescription(
					`Group \`${groupName}\` has been added to user ${userMention(user.id)}, assigning them ${roleIds.length} role${roleIds.length !== 1 ? 's' : ''}: ${roleIds.map(roleMention).join(', ')}`,
				)
				.setColor('Green'),
		],
		allowedMentions: { users: [], roles: [] },
	});
	Logging.quickInfo(interaction, `Added role group \`${groupName}\` to user ${userMention(user.id)}.`);
};
