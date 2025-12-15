import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.blacklist.remove) => {
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
	const dbRbxUser = await Data.models.RobloxUser.findOne({
		where: { guildId: guild.id, userId: userId.toString(), blacklisted: true },
	});
	if (!dbRbxUser) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserNotBlacklisted]), true);
		return;
	}
	await dbRbxUser.update({ blacklisted: false, blacklistReason: null });
	Logging.quickInfo(interaction, `\`${userData.name}\` (\`${userId}\`) has been unblacklisted.`);
	const avtr = await Roblox.idToAvatarBust(userId);
	const toReply = defaultEmbed()
		.setTitle('User unblacklisted')
		.setDescription(`\`${userData.name}\` has been unblacklisted.`)
		.setColor('Green');
	if (avtr.state === 'Completed') toReply.setThumbnail(avtr.imageUrl);
	await interaction.reply({
		embeds: [toReply],
		flags: MessageFlags.Ephemeral,
	});
};
