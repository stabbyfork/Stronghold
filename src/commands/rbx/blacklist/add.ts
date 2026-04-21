import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { getOption, isSetup, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import ms from 'ms';
import parseDur from 'parse-duration';
import { Op } from 'sequelize';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.blacklist.add) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageBlacklist))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageBlacklist),
			true,
		);
		return;
	}
	const username = getOption(interaction, args, 'name');
	const userData = await Roblox.usernameToData(username);
	if (!userData) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RobloxUserNotFound], username), true);
		return;
	}
	const userId = userData.id;
	if (
		await Data.models.RobloxUser.findOne({
			where: {
				guildId: guild.id,
				userId: userId.toString(),
				blacklisted: true,
				blacklistExpiresAt: { [Op.or]: [{ [Op.lte]: new Date() }, { [Op.eq]: null }] },
			},
		})
	) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserAlreadyBlacklisted]), true);
		return;
	}
	const reason = getOption(interaction, args, 'reason');
	const duration = getOption(interaction, args, 'duration');
	let durationSeconds: number | null = null;
	if (duration) {
		try {
			durationSeconds = parseDur(duration);
			if (durationSeconds === null) {
				await reportErrorToUser(interaction, constructError([ErrorReplies.InvalidTimeFormat]), true);
				throw new Errors.HandledError('Invalid duration format');
			}
			if (durationSeconds <= 0) {
				await reportErrorToUser(interaction, constructError([ErrorReplies.DurationTooShort]), true);
				throw new Errors.HandledError('Duration must be positive');
			}
			durationSeconds = Math.floor(durationSeconds / 1000);
			if (durationSeconds > 60 * 60 * 24 * 365 * 1000) {
				await reportErrorToUser(interaction, constructError([ErrorReplies.DurationTooLong]), true);
				throw new Errors.HandledError('Duration is too long');
			}
		} catch (error) {
			if (error instanceof Errors.HandledError) return;
			else {
				throw error;
			}
		}
	}
	await Data.models.RobloxUser.upsert({
		guildId: guild.id,
		userId: userId.toString(),
		blacklisted: true,
		blacklistReason: reason,
		blacklister: interaction.user.id,
		blacklistTime: new Date(),
		blacklistDuration: durationSeconds,
		blacklistExpiresAt: durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null,
	});
	Logging.quickInfo(
		interaction,
		`\`${userData.name}\` (\`${userId}\`) has been blacklisted. Reason: ${reason ?? 'none.'}.`,
	);
	const avatarBust = await Roblox.idToAvatarBust(userData.id);
	const toReply = defaultEmbed()
		.setTitle('User blacklisted')
		.setDescription(
			`\`${userData.name}\` (\`${userId}\`) has been blacklisted ${durationSeconds ? `for ${ms(durationSeconds * 1000, { long: true })}` : 'permanently'} ${reason ? `for the following reason: ${reason}` : 'without a reason.'}`,
		)
		.setColor('Green');
	if (avatarBust.state === 'Completed') toReply.setThumbnail(avatarBust.imageUrl);
	await interaction.reply({
		embeds: [toReply],
	});
};
