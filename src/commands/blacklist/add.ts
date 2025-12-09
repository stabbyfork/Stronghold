import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption, isSetup, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.blacklist.add) => {
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
	if (await Data.models.BlacklistedUser.findOne({ where: { guildId: guild.id, username } })) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.UserAlreadyBlacklisted]), true);
		return;
	}
	await Data.models.BlacklistedUser.create({ guildId: guild.id, username });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('User blacklisted')
				.setDescription(`\`${username}\` has been blacklisted.`)
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
