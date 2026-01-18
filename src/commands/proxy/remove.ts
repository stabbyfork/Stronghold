import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { ProxyUtils } from '../../utils/proxyUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.proxy.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageProxies))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageProxies),
			true,
		);
		return;
	}
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const proxy = getOption(interaction, args, 'proxy');
	if (!(await Data.models.ProxyCommand.findOne({ where: { guildId: guild.id, proxyCommand: proxy } }))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyNotFoundSubstitute], proxy), true);
		return;
	}
	const existing = await ProxyUtils.get(guild.id);
	await Data.mainDb.transaction(async (transaction) => {
		await Data.models.ProxyCommand.destroy({ where: { guildId: guild.id, proxyCommand: proxy }, transaction });
		// Assume single-word proxy
		await ProxyUtils.set(guild.id, ...existing.filter((p) => p.name !== proxy));
	});

	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Proxy removed')
				.setDescription(`Proxy \`${proxy}\` has been removed.`)
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, `Removed proxy \`${proxy}\`.`);
};
