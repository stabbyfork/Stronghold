import Sequelize, { Op, sql } from '@sequelize/core';
import { ChatInputCommandInteraction, Guild, GuildChannel, GuildMember, PermissionsBitField, User } from 'discord.js';
import { Data } from '../data.js';
import { checkBits } from './genericsUtils.js';
import { constructError, reportErrorToUser } from './errorsUtils.js';
import { ErrorReplies, Errors } from '../types/errors.js';

//#region Permissions
export type PermissionField = number;
export enum Permission {
	Administrator = 'administrator',
	NoInactivityKick = 'noActivityKick',
	ManageActivityChecks = 'manageActivityChecks',
	ManagePermissions = 'managePermissions',
	ManagePoints = 'managePoints',
	ManageRanks = 'manageRanks',
	ManageSessions = 'manageSessions',
	ManageRelations = 'manageRelations',
	DiplomacyMessages = 'diplomacyMessages',
}
/**
 * Index using {@link Permission}
 */
export const PermissionBits = {
	[Permission.Administrator]: 0b1,
	[Permission.NoInactivityKick]: 0b10,
	[Permission.ManageActivityChecks]: 0b100,
	[Permission.ManagePermissions]: 0b10000,
	[Permission.ManagePoints]: 0b100000,
	[Permission.ManageRanks]: 0b1000000,
	[Permission.ManageSessions]: 0b10000000,
	[Permission.ManageRelations]: 0b100000000,
	[Permission.DiplomacyMessages]: 0b1000000000,
} as const satisfies { [K in Permission]: number };
checkBits(PermissionBits);

/**
 * Checks if a set of permission bits includes all of the given permissions.
 *
 * @param permissionBits - The permission bits to check.
 * @param permissions - The permissions to check for.
 * @returns True if the permission bits include all of the given permissions, otherwise false.
 */
export function includesAllPermissions(permissionBits: PermissionField, ...permissions: Permission[]) {
	const requiredPerms = permissions.reduce((acc, perm) => acc | PermissionBits[perm], 0);
	return (permissionBits & requiredPerms) === requiredPerms;
}

/**
 * Returns a Sequelize where clause that checks if all of the given permissions are set in the "permissions" field.
 *
 * @param permissions - The permissions to check for.
 * @returns A Sequelize where clause that checks if all of the given permissions are set in the "permissions" field.
 */
export function getWhereForAllPerms(...permissions: Permission[]) {
	const calcPerms = permissions.reduce((acc, perm) => acc | PermissionBits[perm], 0);
	return Sequelize.where(sql`"permissions" & ${calcPerms}`, {
		[Op.eq]: calcPerms,
	});
}

/**
 * Checks if a user has all of the given permissions in the given guild.
 *
 * @param user - The user to check permissions for.
 * @param guild - The guild to check permissions in.
 * @param allowAdmin - Whether to accept Administrator permissions. Defaults to false.
 * @param permissions - The permissions to check for.
 * @returns True if the user has all of the given permissions, otherwise false.
 */
export async function hasPermissions(
	user: GuildMember,
	guild: Guild,
	allowAdmin = false,
	...permissions: Permission[]
) {
	if (user.id === guild.ownerId) return true;
	const dbUser = await Data.models.User.findOne({
		where: {
			guildId: guild.id,
			userId: user.id,
		},
	});
	const userPerms = (await dbUser?.getUserPermission({ where: { guildId: guild.id } }))?.permissions ?? 0;
	if (
		includesAllPermissions(userPerms, ...permissions) ||
		(allowAdmin && includesAllPermissions(userPerms, Permission.Administrator))
	)
		return true;

	const rolePerms = await Data.models.RolePermission.findAll({
		where: {
			guildId: guild.id,
		},
	});
	return rolePerms.some(
		(role) =>
			user.roles.cache.has(role.roleId) &&
			(includesAllPermissions(role.permissions, ...permissions) ||
				(allowAdmin && includesAllPermissions(role.permissions, Permission.Administrator))),
	);
}

export namespace DCPerms {
	export async function getPermissions(
		interaction: ChatInputCommandInteraction,
		scope: { guild: Guild; channel: GuildChannel; user?: User | GuildMember },
		...permissions: (keyof typeof PermissionsBitField.Flags)[]
	) {
		const { guild, channel, user } = scope;
		const member = user
			? (guild.members.cache.get(user.id) ?? (await guild.members.fetch(user.id)))
			: guild.members.me;
		if (!member) {
			await reportErrorToUser(
				interaction,
				constructError(
					[ErrorReplies.UserNotFoundSubstitute, ErrorReplies.ReportToOwner],
					user ? user.id : 'the bot client',
				),
			);
			throw new Errors.HandledError('User not found');
		}
		return channel.permissionsFor(member);
	}
}

//#endregion
