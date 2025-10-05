import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { Data } from '../../data.js';
import { GuildAssociations } from '../../models/guild.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { GuildSessionAssociations } from '../../models/session.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const dbGuild = await Data.models.Guild.findOne({
		where: { guildId: guild.id },
		include: [{ association: GuildAssociations.Session, include: [GuildSessionAssociations.TotalUsers] }],
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
	await guild.roles.fetch(inSessionRoleId, { force: true });
	const users = guild.roles.cache.get(inSessionRoleId)?.members;
	if (!users) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'In session role does not exist'),
			true,
		);
		return;
	}

	const totalUsers = session.totalUsers;
	if (totalUsers === undefined) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'Session does not have total users',
			),
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
					totalUsers.length === 0
						? 'Nobody has joined the session.'
						: (users.size === 0
								? 'Nobody is currently in the session.'
								: `The following users are currently in the session: ${users.map((u) => userMention(u.id)).join(', ')}\n`) +
								`\nThe following users have joined the session at least once: ${totalUsers.map((u) => userMention(u.userId)).join(', ')}`,
				),
		],
		allowedMentions: { roles: [], users: [] },
	});
};
