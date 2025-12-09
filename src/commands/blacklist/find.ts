import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.blacklist.find) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const username = getOption(interaction, args, 'name');
	if (await Data.models.BlacklistedUser.findOne({ where: { guildId: guild.id, username } })) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('User is blacklisted')
					.setDescription(`\`${username}\` is blacklisted.`)
					.setColor('Red'),
			],
			flags: MessageFlags.Ephemeral,
		});
	} else {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('User is not blacklisted')
					.setDescription(`\`${username}\` is not blacklisted.`)
					.setColor('Green'),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
};
