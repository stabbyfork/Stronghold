import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.blacklist.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageBlacklist))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageBlacklist),
			true,
		);
		return;
	}
	const username = getOption(interaction, args, 'name');
	if (!(await Data.models.BlacklistedUser.findOne({ where: { guildId: guild.id, username } }))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserNotBlacklisted]), true);
		return;
	}
	await Data.models.BlacklistedUser.destroy({ where: { guildId: guild.id, username } });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('User unblacklisted')
				.setDescription(`\`${username}\` has been unblacklisted.`)
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
