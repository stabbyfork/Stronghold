import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { reportErrorIfNotSetup, getOption } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.blacklist.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const username = getOption(interaction, args, 'name');
	const userData = await Roblox.usernameToData(username);
	if (!userData) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RobloxUserNotFound], username), true);
		return;
	}
	const userId = userData.id;
	const dbRbxUser = await Data.models.RobloxUser.findOne({
		where: { guildId: guild.id, userId },
		attributes: ['points'],
	});
	if (!dbRbxUser) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserNotFoundSubstitute], username), true);
		return;
	}

	const avtr = await Roblox.idToAvatarBust(userId);
	const toReply = defaultEmbed()
		.setTitle('User points')
		.setDescription(`\`${userData.name}\` has ${dbRbxUser.points} point${dbRbxUser.points === 1 ? '' : 's'}.`)
		.setColor('Green');
	if (avtr.state === 'Completed') toReply.setThumbnail(avtr.imageUrl);
	await interaction.reply({
		embeds: [toReply],
	});
};
