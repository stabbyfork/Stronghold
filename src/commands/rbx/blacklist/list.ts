import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SectionBuilder } from 'discord.js';
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
					.setDescription('There are no blacklisted users. Use `/rbx blacklist add` to add one.')
					.setColor('Red'),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	const pages = new Pages({
		itemsPerPage: 10,
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
			const avatarBusts = await Roblox.idsToAvatarBusts(...users.map((u) => u.userId));
			return new ContainerBuilder()
				.addTextDisplayComponents((text) => text.setContent('## List of blacklisted users'))
				.addSectionComponents(
					...processedUsers.map((u) => {
						const avtr = avatarBusts.find((b) => b.targetId === u.id);
						const section = new SectionBuilder().addTextDisplayComponents((text) =>
							text.setContent(
								`\`${u.displayName}\` (@\`${u.name}\`/\`${u.id}\`)${u.blacklistReason ? `:\n${u.blacklistReason}` : ''}`,
							),
						);
						if (avtr?.state === 'Completed')
							section.setThumbnailAccessory((thumb) => thumb.setURL(avtr.imageUrl));
						return section;
					}),
				);
		},
	});
	await pages.replyTo(interaction, false);
};
