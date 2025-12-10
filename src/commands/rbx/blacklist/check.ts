import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
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
	} else if (usernames.length > 50) {
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
	if (userDatas.length === 1) {
		const userData = userDatas[0];
		if (
			await Data.models.RobloxUser.findOne({
				where: { guildId: guild.id, userId: userData.id, blacklisted: true },
			})
		) {
			await interaction.reply({
				embeds: [
					defaultEmbed()
						.setTitle('User is blacklisted')
						.setDescription(`\`${userData.name}\` (\`${userData.id}\`) is blacklisted.`)
						.setColor('Red'),
				],
			});
		} else {
			await interaction.reply({
				embeds: [
					defaultEmbed()
						.setTitle('User is not blacklisted')
						.setDescription(`\`${userData.name}\` (\`${userData.id}\`) is not blacklisted.`)
						.setColor('Green'),
				],
			});
		}
	} else {
		const notFoundNames = usernames.filter((name) => !userDatas.find((d) => d.name === name));
		if (notFoundNames.length > 0) {
			await reportErrorToUser(
				interaction,
				`Some usernames were not found: ${notFoundNames.map((n) => `\`${n}\``).join(', ')}`,
				true,
			);
			return;
		}
		const inBlacklist = await Data.models.RobloxUser.findAll({
			where: { guildId: guild.id, userId: userDatas.map((d) => d.id) },
		});
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Listed users')
					.setDescription(
						userDatas
							.map((d) => {
								const isBlacklisted = inBlacklist.find((b) => b.userId === d.id);
								return `\`${d.name}\` (\`${d.id}\`)${isBlacklisted ? ' **is** blacklisted' : ' **is not** blacklisted'}`;
							})
							.join('\n'),
					)
					.setColor('Green'),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
};
