import { ChatInputCommandInteraction } from 'discord.js';
import { ErrorReplies } from '../../types/errors.js';
import { isDiploReady } from '../../utils/diplomacyUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await isDiploReady(guild))) return;
	if (interaction.user.id !== guild.ownerId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.MustBeServerOwner]), true);
		return;
	}
	await Data.mainDb.transaction(async (transaction) => {
		await Data.models.Guild.update(
			{
				dpmChannelId: null,
				dpmGame: null,
				serverInvite: null,
				tag: null,
			},
			{
				where: {
					guildId: guild.id,
				},
				transaction,
			},
		);
		await Data.models.RelatedGuild.destroy({
			where: {
				guildId: guild.id,
			},
			transaction,
		});
		await Data.models.RelatedGuild.destroy({
			where: {
				targetGuildId: guild.id,
			},
			transaction,
		});
	});

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Diplomacy removed')
				.setDescription(
					'All diplomatic features have been removed or disabled, and your guild has been unlisted. All relations have been deleted.',
				)
				.setColor('Green'),
		],
	});
};
