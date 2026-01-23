import { ChatInputCommandInteraction, Guild, GuildMember, Role, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

export async function canManageRoleGroup(interaction: ChatInputCommandInteraction, guild: Guild, roleIds: string[]) {
	let roles = (await Promise.all(
		roleIds.map(
			async (roleId) => guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null)),
		),
	)) as Role[];
	if (roles.some((role) => !role)) {
		await reportErrorToUser(
			interaction,
			`The following role IDs are invalid or could not be found in this guild: ${roles
				.map((role: Role | null, idx) => (role ? null : `\`${roleIds[idx]}\``))
				.filter((id) => id !== null)
				.join(', ')}`,
			true,
		);
		return false;
	}
	roles = roles.filter((role) => role !== null);
	const clientHighestRole = guild.members.me?.roles.highest;
	if (!clientHighestRole) {
		await reportErrorToUser(
			interaction,
			`The bot's highest role could not be determined. Please ensure the bot has appropriate permissions and role hierarchy.`,
			true,
		);
		return false;
	}
	if (roles.some((role) => role.position >= clientHighestRole.position)) {
		await reportErrorToUser(
			interaction,
			`The bot does not have permission to assign one or more of the specified roles due to role hierarchy. Please ensure the bot's highest role is above all roles in the group.`,
			true,
		);
		return false;
	}
	if (interaction.user.id !== guild.ownerId) {
		const usrHighest = (interaction.member as GuildMember).roles.highest;
		if (roles.some((role) => role.position >= usrHighest.position)) {
			await reportErrorToUser(
				interaction,
				`You do not have permission to assign one or more of the specified roles due to role hierarchy. Please ensure your highest role is above all roles in the group.`,
				true,
			);
			return false;
		}
	}
	return true;
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.create) => {
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
	if ((await Data.models.RoleGroup.count({ where: { guildId: guild.id } })) >= 32) {
		await reportErrorToUser(
			interaction,
			`This guild has reached the maximum number of role groups (32). Please delete an existing group before creating a new one.`,
			true,
		);
		return;
	}
	const groupName = getOption(interaction, args, 'group_name');
	if (groupName.length === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GroupNameEmpty]), true);
		return;
	}

	if (
		(await Data.models.RoleGroup.findOne({
			where: {
				guildId: guild.id,
				name: groupName,
			},
		})) !== null
	) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` already exists.`, true);
		return;
	}

	const roleIdsString = getOption(interaction, args, 'role_ids');
	if (roleIdsString.length > 1000) {
		await reportErrorToUser(
			interaction,
			`The provided role IDs exceed the maximum allowed length of 1000 characters.`,
			true,
		);
		return;
	}
	const roleIds = Array.from(roleIdsString.matchAll(/(\d+)/g)).map((match) => match[1]);
	if (roleIds.length === 0) {
		await reportErrorToUser(interaction, `No valid role IDs were provided to create the role group.`, true);
		return;
	}
	if (roleIds.length > 16) {
		await reportErrorToUser(
			interaction,
			`A maximum of 16 roles can be included in a single role group. You provided ${roleIds.length} roles.`,
			true,
		);
		return;
	}
	if (!(await canManageRoleGroup(interaction, guild, roleIds))) return;

	await Data.mainDb.transaction(async (transaction) => {
		const roleGroup = await Data.models.RoleGroup.create(
			{
				guildId: guild.id,
				name: groupName,
			},
			{ transaction },
		);
		await Data.models.RoleData.bulkCreate(
			roleIds.map((roleId) => ({
				guildId: guild.id,
				roleId,
			})),
			{ transaction, ignoreDuplicates: true },
		);
		const roleDatas = await Data.models.RoleData.findAll({
			where: {
				guildId: guild.id,
				roleId: roleIds,
			},
			transaction,
		});
		await roleGroup.setRoles(roleDatas, { transaction });
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Role group created')
				.setDescription(
					`Role group \`${groupName}\` has been created, containing ${roleIds.length} role${roleIds.length !== 1 ? 's' : ''}: ${roleIds.map(roleMention).join(', ')}`,
				)
				.setColor('Green'),
		],
	});
	Logging.quickInfo(
		interaction,
		`Created role group \`${groupName}\` with ${roleIds.length} role${roleIds.length !== 1 ? 's' : ''}: ${roleIds.map(roleMention).join(', ')}.`,
	);
};
