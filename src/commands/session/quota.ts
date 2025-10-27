import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import ms from 'ms';
import parse from 'parse-duration';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.quota) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageSessions))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageSessions),
			true,
		);
		return;
	}
	const session = await Data.models.GuildSession.findOne({ where: { guildId: guild.id } });
	if (!session?.active) {
		await reportErrorToUser(interaction, ErrorReplies.NoExistingSession, true);
		return;
	}
	const quota = getOption(interaction, args, 'time');
	const time = quota ? parse(quota) : 0;
	if (time === null) {
		await reportErrorToUser(interaction, ErrorReplies.InvalidTimeFormat, true);
		return;
	}
	await session.update({ timeQuota: time });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Success')
				.setDescription(
					time === 0
						? 'Cleared session time quota.'
						: `Set session time quota to ${ms(time, { long: true })}.`,
				)
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
