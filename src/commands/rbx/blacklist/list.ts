import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { defaultEmbed, Pages } from '../../../utils/discordUtils.js';
import { Data } from '../../../data.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { Roblox } from '../../../utils/robloxUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const nBlacklisted = await Data.models.RobloxUser.count({ where: { guildId: guild.id, blacklisted: true } });
	if (nBlacklisted === 0) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Blacklist is empty')
					.setDescription('There are no blacklisted users.')
					.setColor('Red'),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	const pages = new Pages({
		itemsPerPage: 15,
		totalItems: nBlacklisted,
		createPage: async (index, perPage) => {
			const users = await Data.models.RobloxUser.findAll({
				where: { guildId: guild.id, blacklisted: true },
				limit: perPage,
				offset: index * perPage,
				attributes: ['userId', 'blacklistReason'],
			});
			const processedUsers = (await Roblox.idsToData(...users.map((u) => u.userId))).map((u) => ({
				...u,
				blacklistReason: users.find((b) => b.userId === u.id)!.blacklistReason,
			}));
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of blacklisted users'),
				(text) =>
					text.setContent(
						processedUsers
							.map(
								(u) =>
									`\`${u.displayName}\` (\`@${u.name}\`/\`${u.id}\`)${u.blacklistReason ? `:\n${u.blacklistReason}\n` : ''}`,
							)
							.join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
