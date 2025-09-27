import { ChatInputCommandInteraction, ContainerBuilder, Embed, EmbedBuilder, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../types.js';
import { reportErrorToUser, constructError, getOption, reportErrorIfNotSetup, defaultEmbed } from '../../utils.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { hasPermissions, Permission, PermissionBits } from '../../schema.js';
import { UserAssociations } from '../../models/user.js';
import { RankAssociations } from '../../models/rank.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.view) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	const userToCheck = await guild.members.fetch((getOption(interaction, args, 'user') ?? interaction.user).id);
	const message = defaultEmbed()
		.setTitle(`${userToCheck.displayName}`)
		.setColor('Green')
		.setAuthor({
			name: `Ranking details of @${userToCheck.user.username} (${userToCheck.id})`,
			iconURL: userToCheck.avatarURL() ?? undefined,
		});

	const data = await Data.models.User.findOne({
		where: { guildId: guild.id, userId: userToCheck.id },
		include: [UserAssociations.Rank, UserAssociations.NextRank],
	});
	message.addFields({ name: 'Points', value: data?.points.toString() ?? '0', inline: true });
	const inactiveRoleId = (await Data.models.Guild.findOne({ where: { guildId: guild.id } }))?.inactiveRoleId;
	if (inactiveRoleId && userToCheck.roles.cache.has(inactiveRoleId)) {
		message.addFields({ name: 'Inactive', value: 'Considered inactive', inline: true });
	}
	// TODO: Add rank field
	if (await hasPermissions(userToCheck, guild, true, Permission.NoInactivityKick)) {
		message.addFields({
			name: 'Immune to inactivity kicks',
			value: 'Cannot be kicked for inactivity',
			inline: true,
		});
	}
	const rank = data?.rank;
	const nextRank = data?.nextRank;
	const permissions = (await data?.getUserPermissions({ where: { guildId: guild.id } }))?.[0]?.permissions;
	message.addFields(
		{
			name: 'Inactivity strikes',
			value: data?.inactivityStrikes.toString() ?? '0',
			inline: true,
		},
		{
			name: 'Current rank',
			value: rank ? `${rank.name} (${rank.pointsRequired} points)` : 'None',
			inline: true,
		},
		{
			name: 'Next rank',
			value: nextRank ? `${nextRank.name} (${nextRank.pointsRequired} points)` : 'None',
			inline: true,
		},
		{
			name: 'Permissions',
			value: permissions
				? `${Object.values(Permission)
						.filter((perm) => permissions & PermissionBits[perm])
						.map((perm) => `\`${perm}\``)
						.join(', ')}`
				: 'None',
			inline: true,
		},
	);
	if (rank) {
		const rankRole = guild.roles.cache.get(rank.roleId);
		if (rankRole) message.setColor(rankRole.color);
	}

	await interaction.reply({ embeds: [message] });
};
