import { Transaction, TransactionNestMode } from '@sequelize/core';
import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, userMention } from 'discord.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { User } from '../../../models/user.js';
import { Roblox, UsernameToUserData } from '../../../utils/robloxUtils.js';
import rbx from '../../rbx.js';
import { RobloxUser } from '../../../models/robloxUser.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';

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
	const rbxUsers = await Roblox.usernamesToData(...usernames);
	if (rbxUsers.length === 0) {
		await reportErrorToUser(
			interaction,
			`No users were found matching the username(s) ${usernames.map((n) => `\`${n}\``).join(', ')}.`,
			true,
		);
		return false;
	}
	if (rbxUsers.length !== usernames.length) {
		const notFound = usernames.filter((name) => !rbxUsers.find((d) => d.name === name));
		await reportErrorToUser(
			interaction,
			`Some usernames were not found: ${notFound.map((n) => `\`${n}\``).join(', ')}`,
			true,
		);
		return false;
	}
	try {
		await Data.mainDb.transaction(async (transaction) => {
			for (const usr of rbxUsers) {
				const dbRbxUsr = await Data.models.RobloxUser.findOne({
					where: { guildId: guild.id, userId: usr.id },
					transaction,
				});
				if (dbRbxUsr?.blacklisted) {
					const avtr = await Roblox.idToAvatarBust(usr.id);
					await interaction.reply({
						embeds: [
							defaultEmbed()
								.setColor('Red')
								.setTitle('User is blacklisted')
								.setDescription(
									`${usr.displayName} (${usr.name}/${usr.id}) is blacklisted. Reason: ${dbRbxUsr.blacklistReason ?? 'none.'}`,
								)
								.setThumbnail(avtr.imageUrl),
						],
						flags: MessageFlags.Ephemeral,
					});
					throw new Errors.HandledError('User is blacklisted.');
				}
				const prevData = await Data.models.RobloxUser.findOne({
					where: { guildId: guild.id, userId: usr.id },
				});
				const newPoints = Math.min(
					Math.max(SafeInt32.Min, setPointsFunc(prevData?.points ?? 0, points)),
					SafeInt32.Max,
				);
				if (prevData) {
					await prevData.update({ points: newPoints }, { transaction });
				} else {
					await Data.models.RobloxUser.create(
						{ guildId: guild.id, userId: usr.id, points: newPoints },
						{ transaction },
					);
				}
			}
		});
	} catch (e) {
		if (e instanceof Errors.HandledError) return false;
		throw e;
	}
	if (interaction.replied) {
		await interaction.followUp({
			embeds: [successEmbed(rbxUsers, points)],
		});
	} else {
		await interaction.reply({
			embeds: [successEmbed(rbxUsers, points)],
		});
	}
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
					`Set point count to \`${points}\` for ${users.map((u) => `\`${u.name}\``).join(', ')}.`,
				),
		(users, points) =>
			`Set point count of ${users.map((u) => `\`${u.displayName}\` (\`${u.name}\`/\`${u.id}\`)`).join(', ')} to \`${points}\``,
	);
};
