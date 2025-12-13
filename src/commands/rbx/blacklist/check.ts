import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SectionBuilder } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.blacklist.check) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const usernames = getOption(interaction, args, 'names').trim().split(' ');
	if (usernames.length === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoUsernamesProvided]), true);
		return;
	} else if (usernames.length > 10) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.TooManyUsernamesProvided]), true);
		return;
	}
	const userDatas = await Roblox.usernamesToData(...usernames);
	if (userDatas.length === 0) {
		await reportErrorToUser(
			interaction,
			`No users were found matching the username(s) ${usernames.map((n) => `\`${n}\``).join(', ')}.`,
			true,
		);
		return;
	}
	const avatarBusts = await Roblox.idsToAvatarBusts(...userDatas.map((d) => d.id));
	if (userDatas.length === 1) {
		const userData = userDatas[0];
		const avtr = avatarBusts[0];
		const toReply = defaultEmbed();
		if (avtr.state === 'Completed') toReply.setThumbnail(avtr.imageUrl);
		const foundUsr = await Data.models.RobloxUser.findOne({
			where: { guildId: guild.id, userId: userData.id, blacklisted: true },
			attributes: ['blacklistReason', 'blacklisted'],
		});
		if (foundUsr?.blacklisted) {
			await interaction.reply({
				embeds: [
					toReply
						.setTitle('User is blacklisted')
						.setDescription(
							`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`) is blacklisted. Reason: ${foundUsr.blacklistReason ?? 'none.'}`,
						)
						.setColor('Red'),
				],
			});
		} else {
			await interaction.reply({
				embeds: [
					toReply
						.setTitle('User is not blacklisted')
						.setDescription(
							`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`) is not blacklisted.`,
						)
						.setColor('Green'),
				],
			});
		}
	} else {
		const notFoundNames = usernames.filter((name) => !userDatas.find((d) => d.requestedUsername === name));
		if (notFoundNames.length > 0) {
			await reportErrorToUser(
				interaction,
				`Some usernames were not found: ${notFoundNames.map((n) => `\`${n}\``).join(', ')}`,
				true,
			);
			return;
		}
		const inBlacklist = await Data.models.RobloxUser.findAll({
			where: { guildId: guild.id, userId: userDatas.map((d) => d.id), blacklisted: true },
		});
		const avatarBusts = await Roblox.idsToAvatarBusts(...userDatas.map((d) => d.id));
		const toReply = new ContainerBuilder()
			.addTextDisplayComponents((text) => text.setContent('## Checked users'))
			.addSectionComponents(
				...userDatas.map((d) => {
					const isBlacklisted = inBlacklist.find((b) => b.userId === d.id);
					const avtr = avatarBusts.find((b) => b.targetId === d.id);
					const section = new SectionBuilder().addTextDisplayComponents((text) =>
						text.setContent(
							`${isBlacklisted ? ':warning:' : ':white_check_mark:'} \`${d.displayName}\` (\`${d.name}\`/\`${d.id}\`)${isBlacklisted ? ` **is** blacklisted :warning: Reason: ${isBlacklisted.blacklistReason ?? 'none.'}` : ' **is not** blacklisted :white_check_mark:'}`,
						),
					);
					if (avtr?.state === 'Completed')
						section.setThumbnailAccessory((thumb) => thumb.setURL(avtr.imageUrl));
					return section;
				}),
			);
		await interaction.reply({
			components: [toReply],
			flags: MessageFlags.IsComponentsV2,
		});
	}
};
