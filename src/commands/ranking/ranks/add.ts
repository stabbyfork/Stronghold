import { ChatInputCommandInteraction, GuildMember, MessageFlags, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup, getOption } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.add) => {
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
	if (!(await hasPermissions(member, guild, true, Permission.ManageRanks))) return;
	const name = getOption(interaction, args, 'name');
	const points = getOption(interaction, args, 'points');
	const limit = getOption(interaction, args, 'limit') ?? -1;
	const existing = getOption(interaction, args, 'existing_role');
	if (!existing && !name) {
		await interaction.reply({
			embeds: [
				defaultEmbed().setTitle('Error').setDescription('You must either provide a name OR an existing role.'),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
	if (existing && name) {
		await guild.roles.edit(existing, {
			name,
			reason: `Renamed by /ranking ranks add, supplied with both an existing role and name. By: ${interaction.user.id}`,
		});
	}
	if (await Data.models.Rank.findOne({ where: { guildId: guild.id, name: name ? name : existing!.name } })) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.RankExistsSubstitute], name ?? 'no name specified'),
			true,
		);
		return;
	}

	const role = await Data.models.Rank.create({
		guildId: guild.id,
		name: name ?? existing!.name,
		pointsRequired: points,
		userLimit: limit,
		roleId: existing
			? existing.id
			: (
					await guild.roles.create({
						name: name!,
						permissions: [],
						hoist: true,
						reason: 'Created by /ranking ranks add. By: ' + interaction.user.id,
					})
				).id,
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Rank added')
				.setColor('Green')
				.setDescription(
					`Added rank ${roleMention(role.roleId)} (${role.roleId}). You may change the role colour in the server's roles menu.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
	Logging.quickInfo(interaction, `Added rank ${roleMention(role.roleId)} (${role.roleId}).`);
};
