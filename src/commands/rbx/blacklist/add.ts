import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { getOption, isSetup, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { ErrorReplies } from '../../../types/errors.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

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
	if (await Data.models.RobloxUser.findOne({ where: { guildId: guild.id, userId, blacklisted: true } })) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserAlreadyBlacklisted]), true);
		return;
	}
	const reason = getOption(interaction, args, 'reason');
	await Data.models.RobloxUser.create({ guildId: guild.id, userId, blacklisted: true, blacklistReason: reason });
	Logging.quickInfo(
		interaction,
		`\`${userData.name}\` (\`${userId}\`) has been blacklisted for the reason: ${reason}.`,
	);
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('User blacklisted')
				.setDescription(
					`\`${userData.name}\` (\`${userId}\`) has been blacklisted for the following reason: ${reason}.`,
				)
				.setColor('Green'),
		],
	});
};
