import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags } from 'discord.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { defaultEmbed, Pages } from '../../utils/discordUtils.js';
import { Data } from '../../data.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const nBlacklisted = await Data.models.BlacklistedUser.count({ where: { guildId: guild.id } });
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
		itemsPerPage: 25,
		totalItems: nBlacklisted,
		createPage: async (index, perPage) => {
			const users = await Data.models.BlacklistedUser.findAll({
				where: { guildId: guild.id },
				limit: perPage,
				offset: index * perPage,
			});
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of blacklisted users'),
				(text) => text.setContent(users.map((u) => `\`${u.username}\``).join('\n')),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
