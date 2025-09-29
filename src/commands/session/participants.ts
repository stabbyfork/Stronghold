import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { Data } from '../../data.js';
import { GuildAssociations } from '../../models/guild.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const dbGuild = await Data.models.Guild.findOne({
		where: { guildId: guild.id },
		include: [GuildAssociations.Session],
	});
	const session = dbGuild?.session;
	if (!session || !session.active) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingSession]), true);
		return;
	}
	const inSessionRoleId = dbGuild.inSessionRoleId;
	if (!inSessionRoleId) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'Guild does not have in session role',
			),
			true,
		);
		return;
	}
	const users = (await guild.roles.fetch(inSessionRoleId))?.members;
	if (!users) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'In session role does not exist'),
			true,
		);
		return;
	}

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Participants')
				.setColor('Green')
				.setDescription(
					users.size === 0
						? 'No users have marked themselves as in the session.'
						: `The following users have marked themselves as in the session: ${users.map((u) => userMention(u.id)).join(', ')}`,
				),
		],
	});
};
