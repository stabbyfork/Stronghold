import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { ProxyUtils } from '../../utils/proxyUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (guild.ownerId !== interaction.user.id) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.MustBeServerOwner]), true);
		return;
	}
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	await Data.mainDb.transaction(async (transaction) => {
		await Data.models.ProxyCommand.destroy({ where: { guildId: guild.id }, transaction });
		await ProxyUtils.clear(guild.id);
	});

	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Proxies cleared')
				.setDescription('All command proxies have been cleared.')
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, 'All command proxies have been cleared.');
};
