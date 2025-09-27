import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { hasPermissions, Permission, PermissionBits } from '../../../schema.js';
import { ErrorReplies } from '../../../types.js';
import { constructError, defaultEmbed, getOption, reportErrorIfNotSetup, reportErrorToUser } from '../../../utils.js';

export async function setPermissionsWithInteractionRoles({
	interaction,
	roleIds,
	permissions,
	setPermFunc,
	createSuccessEmbed,
}: {
	interaction: ChatInputCommandInteraction;
	roleIds: string;
	permissions: string;
	setPermFunc: (prevPerms: number, givenPerms: number) => number;
	createSuccessEmbed?: (roles: string[], permissions: string[]) => EmbedBuilder;
}) {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const member = interaction.member as GuildMember;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	const isAdmin = await hasPermissions(member, guild, false, Permission.Administrator);
	if (!isAdmin && !(await hasPermissions(member, guild, false, Permission.ManagePermissions))) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.PermissionError, ErrorReplies.PermissionsNeededSubstitute],
				Permission.ManagePermissions,
			),
			true,
		);
		return;
	}

	const possiblePerms = Object.values(Permission);
	const splitPerms = permissions.split(' ').map((p) => p.trim());
	const roles = Array.from(roleIds.matchAll(/<@&(\d+)>/g)).map((m) => m[1]);
	if (roles.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one role.', true);
		return;
	}
	let accumulatedPerms = 0;
	for (const perm of splitPerms) {
		if (!possiblePerms.includes(perm as Permission)) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.InvalidPermissionSubstitute], perm),
				true,
			);
			return;
		} else if (!isAdmin && perm === Permission.ManagePermissions) {
			await reportErrorToUser(
				interaction,
				'You do not have permission to set the `managePermissions` permission. You must be a bot administrator (in the server) to do so.',
				true,
			);
			return;
		} else if (perm === Permission.Administrator && member.id !== guild.ownerId) {
			await reportErrorToUser(
				interaction,
				'You do not have permission to set the `administrator` permission. You must be the server owner to do so.',
				true,
			);
			return;
		}

		accumulatedPerms |= PermissionBits[perm as Permission];
	}
	for (const roleId of roles) {
		// TODO: Make sure user has a higher role than the role being modified
		const role = guild.roles.cache.get(roleId);
		if (role) {
			if (!isAdmin && member.roles.cache.has(roleId)) {
				await reportErrorToUser(
					interaction,
					`You do not have permission to manage permissions for roles you are in: ${roleMention(roleId)}. You must be a bot administrator to do so.`,
					true,
				);
				return;
			} else if (role.position >= member.roles.highest.position && member.id !== guild.ownerId) {
				await reportErrorToUser(
					interaction,
					`You do not have permission to manage permissions for roles above your highest role: ${roleMention(roleId)}. You must be the server owner to do so.`,
					true,
				);
				return;
			}
			const prevPerms = await Data.models.RolePermission.findOne({
				where: { guildId: guild.id, roleId: role.id },
			});
			// Potential data loss!!
			const newPerms = setPermFunc(prevPerms?.permissions ?? 0, accumulatedPerms);
			if (prevPerms) {
				if (prevPerms.permissions === newPerms) {
					await reportErrorToUser(
						interaction,
						constructError([ErrorReplies.UserAlreadyHasPermissionsSubstitute], roleMention(role.id)),
						true,
					);
					return;
				} else if (
					prevPerms.permissions & PermissionBits[Permission.Administrator] &&
					member.id !== guild.ownerId
				) {
					await reportErrorToUser(
						interaction,
						'You do not have permission to manage roles with the `administrator` permission. You must be the server owner to do so.',
						true,
					);
					return;
				}
				await prevPerms.update({ permissions: newPerms });
			} else {
				await Data.models.RolePermission.create({
					guildId: guild.id,
					roleId: role.id,
					permissions: newPerms,
				});
			}
		} else {
			await reportErrorToUser(interaction, constructError([ErrorReplies.RoleNotFoundSubstitute], roleId), true);
			return;
		}
	}
	if (createSuccessEmbed) {
		await interaction.reply({
			embeds: [createSuccessEmbed(roles, splitPerms)],
			flags: MessageFlags.Ephemeral,
			allowedMentions: { roles: [], users: [] },
		});
		return;
	}
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.roles.set) => {
	setPermissionsWithInteractionRoles({
		interaction,
		roleIds: getOption(interaction, args, 'roles'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (_, newPerms) => newPerms,
		createSuccessEmbed: (roles, permissions) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					permissions.length === 0
						? 'No permissions set.'
						: `Set granted permissions to ${permissions.map((perm) => `\`${perm}\``).join(', ')} for ${roles.map(roleMention).join(', ')} successfully.`,
				),
	});
};
