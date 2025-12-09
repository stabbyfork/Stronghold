import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';

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
	await Data.models.BlacklistedUser.destroy({ where: { guildId: guild.id } });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Blacklist cleared')
				.setDescription('The blacklist has been cleared.')
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
