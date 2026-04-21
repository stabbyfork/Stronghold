import { Dui } from '@dui/core.js';
import {
	ChatInputCommandInteraction,
	ContainerBuilder,
	MessageFlags,
	SectionBuilder,
	TextDisplayBuilder,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import ms from 'ms';
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
			where: { guildId: guild.id, userId: userData.id.toString(), blacklisted: true },
			attributes: ['blacklistReason', 'blacklister', 'blacklistTime', 'blacklistDuration'],
		});
		// Implied to be blacklisted
		if (foundUsr) {
			await interaction.reply({
				...Dui.render(
					Dui.createContainer(
						{
							accentColor: 'Red',
						},
						Dui.createText('## User is blacklisted'),
						Dui.h(
							'section',
							avtr.state === 'Completed' ? { accessory: Dui.h('thumbnail', { url: avtr.imageUrl }) } : {},
							Dui.createText(
								`**Blacklist details**\n- Reason: ${foundUsr.blacklistReason ?? 'none.'}\n- Blacklisted on ${time(foundUsr.blacklistTime!, TimestampStyles.LongDateShortTime)} ${foundUsr.blacklistDuration ? `for ${ms(foundUsr.blacklistDuration * 1000, { long: true })}` : 'permanently'}\n- By ${userMention(foundUsr.blacklister!)}`,
							),
						),
					),
				),
				allowedMentions: { users: [], roles: [] },
			});
		} else {
			await interaction.reply({
				...Dui.render(
					Dui.createContainer(
						{
							accentColor: 'Green',
						},
						Dui.createText('## User is not blacklisted'),
						Dui.h(
							'section',
							avtr.state === 'Completed' ? { accessory: Dui.h('thumbnail', { url: avtr.imageUrl }) } : {},
							Dui.createText(
								`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`) is not blacklisted.`,
							),
						),
					),
				),
				allowedMentions: { users: [], roles: [] },
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
			where: { guildId: guild.id, userId: userDatas.map((d) => d.id.toString()), blacklisted: true },
		});
		const avatarBusts = await Roblox.idsToAvatarBusts(...userDatas.map((d) => d.id));
		const toReply = new ContainerBuilder()
			.addTextDisplayComponents((text) => text.setContent('## Checked users'))
			.addSectionComponents(
				...userDatas.map((d) => {
					const usrId = d.id.toString();
					const blData = inBlacklist.find((b) => b.userId === usrId);
					const avtr = avatarBusts.find((b) => b.targetId === d.id);

					const section = new SectionBuilder().addTextDisplayComponents(
						(text) =>
							text.setContent(
								`${blData ? ':warning:' : ':white_check_mark:'} \`${d.displayName}\` (\`${d.name}\`/\`${d.id}\`)${blData ? ` **is** blacklisted :warning: Reason: ${blData.blacklistReason ?? 'none.'}` : ' **is not** blacklisted :white_check_mark:'}`,
							),
						...(blData
							? [
									(text: TextDisplayBuilder) =>
										text.setContent(
											`-# Blacklisted on ${time(blData.blacklistTime!, TimestampStyles.LongDateShortTime)} ${blData.blacklistDuration ? `for ${ms(blData.blacklistDuration * 1000, { long: true })}` : 'permanently'} by ${userMention(blData.blacklister!)}`,
										),
								]
							: []),
					);
					if (avtr?.state === 'Completed')
						section.setThumbnailAccessory((thumb) => thumb.setURL(avtr.imageUrl));
					return section;
				}),
			);
		await interaction.reply({
			components: [toReply],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { users: [], roles: [] },
		});
	}
};
