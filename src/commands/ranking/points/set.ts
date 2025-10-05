import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, userMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { Transaction } from '@sequelize/core';
import { User } from '../../../models/user.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup, getOption } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { GuildFlag } from '../../../utils/guildFlagsUtils.js';

const enum SafeInt32 {
	Min = -(2 ** 31),
	Max = 2 ** 31 - 1,
}

export async function setPointsWithInteraction(
	interaction: ChatInputCommandInteraction,
	users: string,
	points: number,
	setPointsFunc: (prevPoints: number, givenPoints: number) => number,
	successEmbed: (userIds: string[], points: number) => EmbedBuilder,
	logText: (userIds: string[], points: number) => string,
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
	if (points < 0) {
		await reportErrorToUser(interaction, 'Point count must be a positive number.', true);
		return;
	}
	const userIds = Array.from(users.matchAll(/<@(\d+)>/g)).map((match) => match[1]);
	if (userIds.length === 0) {
		await reportErrorToUser(interaction, 'You must provide at least one user.', true);
	}
	try {
		await Data.mainDb.transaction(async (transaction: Transaction) => {
			for (const userId of userIds) {
				const user = guild.members.cache.get(userId);
				if (!user) {
					await reportErrorToUser(
						interaction,
						constructError([ErrorReplies.UserNotFoundSubstitute], userMention(userId)),
						true,
					);
					throw new Errors.NotFoundError('User not found');
				}
				const prevData = await Data.models.User.findOne({
					where: { guildId: guild.id, userId: userId },
					transaction,
				});
				let data: User;
				const newPoints = Math.min(
					Math.max(SafeInt32.Min, setPointsFunc(prevData?.points ?? 0, points)),
					SafeInt32.Max,
				);
				if (prevData) {
					await prevData.update({ points: newPoints }, { transaction });
					data = prevData;
				} else {
					data = await Data.models.User.create(
						{ guildId: guild.id, userId: userId, points: newPoints },
						{ transaction },
					);
				}
				await Data.promoteUser(data, transaction).catch(async (e) => {
					// Send to user
					if (e instanceof Errors.DatabaseError) {
						reportErrorToUser(interaction, constructError([ErrorReplies.OnlySubstitute], e.message), true);
					} else {
						// Unexpected
						throw e;
					}
				});
			}
		});
	} catch (e) {
		if (e instanceof Errors.NotFoundError) return;
		throw e;
	}

	await interaction.reply({
		embeds: [successEmbed(userIds, points)],
	});
	Logging.quickInfo(interaction, logText(userIds, points));
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.points.set) => {
	await setPointsWithInteraction(
		interaction,
		getOption(interaction, args, 'users'),
		getOption(interaction, args, 'points'),
		(_, givenPoints) => givenPoints,
		(userIds, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(`Set point count to \`${points}\` for ${userIds.map(userMention).join(', ')}.`),
		(userIds, points) => `Set points of ${userIds.map(userMention).join(', ')} to ${points}`,
	);
};
