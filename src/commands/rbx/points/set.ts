import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, userMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Roblox, UsernameToUserData } from '../../../utils/robloxUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

const enum SafeInt32 {
	Min = -(2 ** 31),
	Max = 2 ** 31 - 1,
}
/**
 * If a transaction is given, DOES NOT ROLLBACK ON ERROR! Instead, it throws the error.
 * Returns whether points were set or not (true = points set)
 * */
export async function setRbxPoints(
	interaction: ChatInputCommandInteraction,
	users: string,
	points: number,
	setPointsFunc: (prevPoints: number, givenPoints: number) => number,
	successEmbed: (users: UsernameToUserData[], points: number) => EmbedBuilder,
	logText: (users: UsernameToUserData[], points: number) => string,
) {
	if (!(await reportErrorIfNotSetup(interaction))) return false;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return false;
	}
	const usr = interaction.member as GuildMember | null;
	if (!usr) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return false;
	}
	if (!(await hasPermissions(usr, guild, true, Permission.ManagePoints))) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.PermissionError, ErrorReplies.PermissionsNeededSubstitute],
				Permission.ManagePoints,
			),
			true,
		);
		return false;
	}
	const usernames = users.split(' ');
	if (usernames.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one username.', true);
		return false;
	}
	if (usernames.length > 50) {
		await reportErrorToUser(interaction, 'You can only set points for up to 50 users at once.', true);
		return false;
	}
	if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
	const rbxUsers = await Roblox.usernamesToData(...usernames);
	if (rbxUsers.length === 0) {
		await reportErrorToUser(
			interaction,
			`No users were found matching the username(s) ${usernames.map((n) => `\`${n}\``).join(', ')}.\n-# Points were not modified.`,
			true,
		);
		return false;
	}
	if (rbxUsers.length !== usernames.length) {
		const notFound = usernames.filter((name) => !rbxUsers.find((d) => d.requestedUsername === name));
		await reportErrorToUser(
			interaction,
			`Some usernames were not found: ${notFound.map((n) => `\`${n}\``).join(', ')}\n-# Points were not modified.`,
			true,
		);
		return false;
	}
	try {
		await Data.mainDb.transaction(async (transaction) => {
			for (const usr of rbxUsers) {
				const userId = usr.id.toString();
				const dbRbxUsr = await Data.models.RobloxUser.findOne({
					where: { guildId: guild.id, userId },
					transaction,
				});
				if (dbRbxUsr?.blacklisted) {
					const avtr = await Roblox.idToAvatarBust(usr.id);
					const toReply = defaultEmbed()
						.setColor('Red')
						.setTitle('User is blacklisted')
						.setDescription(
							`\`${usr.displayName}\` (\`${usr.name}\`/\`${usr.id}\`) is blacklisted by ${userMention(dbRbxUsr.blacklister!)}. Reason: ${dbRbxUsr.blacklistReason ?? 'none provided.'}`,
						);
					if (avtr.state === 'Completed') {
						toReply.setThumbnail(avtr.imageUrl);
					}
					await interaction.followUp({
						embeds: [toReply],
						flags: MessageFlags.Ephemeral,
					});
					throw new Errors.HandledError('User is blacklisted.');
				}
				const newPoints = Math.min(
					Math.max(SafeInt32.Min, setPointsFunc(dbRbxUsr?.points ?? 0, points)),
					SafeInt32.Max,
				);
				if (dbRbxUsr) {
					await dbRbxUsr.update({ points: newPoints }, { transaction });
				} else {
					await Data.models.RobloxUser.create(
						{ guildId: guild.id, userId, points: newPoints },
						{ transaction },
					);
				}
			}
		});
	} catch (e) {
		if (e instanceof Errors.HandledError) return false;
		throw e;
	}
	await interaction.editReply({
		embeds: [successEmbed(rbxUsers, points)],
	});
	Logging.quickInfo(interaction, logText(rbxUsers, points));
	return true;
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.points.set) => {
	setRbxPoints(
		interaction,
		getOption(interaction, args, 'names'),
		getOption(interaction, args, 'points'),
		(_, givenPoints) => givenPoints,
		(users, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Set point count to \`${points}\` for:\n${users.map((u) => `- \`${u.name}\``).join(',\n')}\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
				),
		(users, points) =>
			`Set point count of:\n${users.map((u) => `\`${u.displayName}\` (\`${u.name}\`/\`${u.id}\`)`).join(',\n')} to \`${points}\`\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
	);
};
