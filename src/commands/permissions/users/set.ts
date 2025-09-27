import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, userMention } from 'discord.js';
import { Data } from '../../../data.js';
import { hasPermissions, Permission, PermissionBits } from '../../../schema.js';
import { ErrorReplies, Errors } from '../../../types.js';
import { reportErrorIfNotSetup, reportErrorToUser, constructError, defaultEmbed, getOption } from '../../../utils.js';
import { commandOptions } from '../../../cmdOptions.js';

export async function setPermissionsWithInteractionUsers({
	interaction,
	userIds,
	permissions,
	setPermFunc,
	createSuccessEmbed,
}: {
	interaction: ChatInputCommandInteraction;
	userIds: string;
	permissions: string;
	setPermFunc: (prevPerms: number, givenPerms: number) => number;
	// User IDs
	createSuccessEmbed?: (userIds: string[], permissions: string[]) => EmbedBuilder;
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
	const users = Array.from(userIds.matchAll(/<@(\d+)>/g)).map((m) => m[1]);
	let accumulatedPerms = 0;
	if (users.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one user.', true);
		return;
	}
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
				'You do not have permission to manage the `managePermissions` permission. You must be a bot administrator (in the server) to do so.',
				true,
			);
			return;
		} else if (perm === Permission.Administrator && member.id !== guild.ownerId) {
			await reportErrorToUser(
				interaction,
				'You do not have permission to manage the `administrator` permission. You must be the server owner to do so.',
				true,
			);
			return;
		}

		accumulatedPerms |= PermissionBits[perm as Permission];
	}
	Data.mainDb
		.transaction(async (transaction) => {
			for (const userId of users) {
				const user = guild.members.cache.get(userId);
				if (user) {
					if (userId === member.id && userId !== guild.ownerId) {
						await reportErrorToUser(
							interaction,
							'You do not have permission to set your own permissions. You must be the server owner to do so.',
							true,
						);
						throw new Errors.HandledError('User cannot be managed');
					} else if (
						member.roles.highest.position <= user.roles.highest.position &&
						member.id !== guild.ownerId
					) {
						await reportErrorToUser(
							interaction,
							'You do not have permission to manage users with a higher role than you. You must be the server owner to do so.',
							true,
						);
						throw new Errors.HandledError('User cannot be managed');
					}
					const prevPerms = await Data.models.UserPermission.findOne({
						where: { guildId: guild.id, userId: user.id },
					});
					// Potential data loss!!
					const newPerms = setPermFunc(prevPerms?.permissions ?? 0, accumulatedPerms);
					if (prevPerms) {
						if (prevPerms.permissions === newPerms) {
							await reportErrorToUser(
								interaction,
								constructError([ErrorReplies.UserAlreadyHasPermissionsSubstitute], userMention(userId)),
								true,
							);
							throw new Errors.HandledError('User already has permissions');
						} else if (
							prevPerms.permissions & PermissionBits[Permission.Administrator] &&
							member.id !== guild.ownerId
						) {
							await reportErrorToUser(
								interaction,
								'You do not have permission to manage users with the `administrator` permission. You must be the server owner to do so.',
								true,
							);
							throw new Errors.HandledError('User cannot be managed');
						}
						await prevPerms.update({ permissions: newPerms }, { transaction });
					} else {
						const [dbUser] = await Data.models.User.findCreateFind({
							where: { userId: user.id },
							defaults: { userId: user.id, guildId: guild.id },
							transaction,
						});
						await Data.models.UserPermission.create(
							{
								guildId: guild.id,
								userId: dbUser.id,
								permissions: newPerms,
							},
							{ transaction },
						);
					}
				} else {
					await reportErrorToUser(
						interaction,
						constructError([ErrorReplies.UserNotFoundSubstitute], userId),
						true,
					);
					throw new Errors.HandledError('User not found');
				}
			}
		})
		.catch(async (err) => {
			if (!(err instanceof Errors.HandledError)) {
				throw err;
			}
		});

	if (createSuccessEmbed) {
		await interaction.reply({
			embeds: [createSuccessEmbed(users, splitPerms)],
			flags: MessageFlags.Ephemeral,
			allowedMentions: { roles: [], users: [] },
		});
		return;
	}
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.users.set) => {
	setPermissionsWithInteractionUsers({
		interaction,
		userIds: getOption(interaction, args, 'users'),
		permissions: getOption(interaction, args, 'permissions'),
		setPermFunc: (_, givenPerms) => givenPerms,
		createSuccessEmbed: (users, permissions) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Set granted permissions to ${permissions.map((perm) => `\`${perm}\``).join(', ')} for ${users.map(userMention).join(', ')} successfully.`,
				),
	});
};
