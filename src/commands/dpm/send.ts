import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../types/errors.js';
import { DPM, isDiploReady } from '../../utils/diplomacyUtils.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.send) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await isDiploReady(interaction.guild))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.DiploNotSetup]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.DiplomacyMessages))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRelations),
			true,
		);
		return;
	}
	const tag = getOption(interaction, args, 'tag').toLowerCase();
	const message = getOption(interaction, args, 'message');
	const target = await Data.models.Guild.findOne({ where: { tag }, attributes: ['guildId'] });
	if (!target) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GuildTagNotFound], tag), true);
		return;
	}
	await DPM.transaction({ source: guild.id, target: target.guildId }, DPM.TransactionType.MessageSend, {
		message,
		author: interaction.user,
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Message sent')
				.setDescription(`Sent message to guild with tag \`${tag}\`:\n${message}`),
		],
	});
};
