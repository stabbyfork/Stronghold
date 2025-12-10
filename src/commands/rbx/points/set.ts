import { Transaction } from '@sequelize/core';
import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, userMention } from 'discord.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { User } from '../../../models/user.js';
import { Roblox, UsernameToUserData } from '../../../utils/robloxUtils.js';
import rbx from '../../rbx.js';
import { RobloxUser } from '../../../models/robloxUser.js';

const enum SafeInt32 {
	Min = -(2 ** 31),
	Max = 2 ** 31 - 1,
}

export async function setPointsWithInteraction(
	interaction: ChatInputCommandInteraction,
	users: string,
	points: number,
	setPointsFunc: (prevPoints: number, givenPoints: number) => number,
	successEmbed: (users: UsernameToUserData[], points: number) => EmbedBuilder,
	logText: (users: UsernameToUserData[], points: number) => string,
) {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const usr = interaction.member as GuildMember | null;
	if (!usr) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
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
		return;
	}
	const usernames = users.split(' ');
	if (usernames.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one username.', true);
		return;
	}
	if (usernames.length > 50) {
		await reportErrorToUser(interaction, 'You can only set points for up to 50 users at once.', true);
		return;
	}
	try {
		const rbxUsers = await Roblox.usernamesToData(...usernames);
		if (rbxUsers.length === 0) {
			await reportErrorToUser(
				interaction,
				`No users were found matching the username(s) ${usernames.map((n) => `\`${n}\``).join(', ')}.`,
				true,
			);
			return;
		}
		if (rbxUsers.length !== usernames.length) {
			const notFound = usernames.filter((name) => !rbxUsers.find((d) => d.name === name));
			await reportErrorToUser(
				interaction,
				`Some usernames were not found: ${notFound.map((n) => `\`${n}\``).join(', ')}`,
				true,
			);
			return;
		}
		await Data.mainDb.transaction(async (transaction: Transaction) => {
			for (const usr of rbxUsers) {
				const prevData = await Data.models.RobloxUser.findOne({
					where: { guildId: guild.id, userId: usr.id },
					transaction,
				});
				let data: RobloxUser;
				const newPoints = Math.min(
					Math.max(SafeInt32.Min, setPointsFunc(prevData?.points ?? 0, points)),
					SafeInt32.Max,
				);
				if (prevData) {
					await prevData.update({ points: newPoints }, { transaction });
					data = prevData;
				} else {
					data = await Data.models.RobloxUser.create(
						{ guildId: guild.id, userId: usr.id, points: newPoints },
						{ transaction },
					);
				}
			}
		});
		await interaction.reply({
			embeds: [successEmbed(rbxUsers, points)],
		});
		Logging.quickInfo(interaction, logText(rbxUsers, points));
	} catch (e) {
		if (e instanceof Errors.NotFoundError) return;
		throw e;
	}
}
