import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { reportErrorToUser } from '../../utils/errorsUtils.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { AdUtils } from '../../utils/adUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.set.ads) => {
	if (!interaction.inGuild()) {
		await reportErrorToUser(interaction, 'This command can only be used in a server.', true);
		return;
	}
	const enabled = getOption(interaction, args, 'enabled') ?? false;
	const [user, created] = await Data.models.User.findCreateFind({
		where: {
			guildId: interaction.guildId,
			userId: interaction.user.id,
		},
		defaults: {
			adsEnabled: enabled,
			guildId: interaction.guildId,
			userId: interaction.user.id,
		},
	});
	if (!created) {
		user.adsEnabled = enabled;
		await user.save();
	}
	AdUtils.setCache(interaction.guildId, interaction.user.id, enabled);
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setDescription(
					`Successfully ${enabled ? 'enabled' : 'disabled'} advertisements for you in this server.\nYou might still see adverts in other servers or commands run by other users.`,
				)
				.setColor('Green')
				.setTitle(`Ads ${enabled ? 'enabled' : 'disabled'}`),
		],
		flags: MessageFlags.Ephemeral,
	});
};
