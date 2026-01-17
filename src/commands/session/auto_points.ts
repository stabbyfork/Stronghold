import { ChatInputCommandInteraction } from 'discord.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.auto_points) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const points = getOption(interaction, args, 'points');
	const mustMeetQuota = getOption(interaction, args, 'must_meet_quota') ?? false;

	const session = await Data.models.GuildSession.findOne({ where: { guildId: guild.id } });
	if (!session) {
		await reportErrorToUser(interaction, ErrorReplies.SessionNotCreated, true);
		return;
	}

	if (points === 0) {
		await session.update({ pointsToAdd: null, mustMeetQuota: false });
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Disabled automatic point adding')
					.setColor('Green')
					.setDescription('Points will no longer be given to session participants when a session ends.'),
			],
		});
		return;
	}
	if (points === null) {
		const pointsToAdd = session.pointsToAdd;
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Number of points added automatically')
					.setColor('Green')
					.setDescription(
						`Session participants receive ${pointsToAdd} points after a session ends.\nUsers ${session.mustMeetQuota ? 'must' : 'do not need to'} meet the time quota to get points.`,
					),
			],
		});
		return;
	}
	await session.update({ pointsToAdd: points, mustMeetQuota: mustMeetQuota });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Automatic point adding updated')
				.setColor('Green')
				.setDescription(
					`Session participants now receive ${points} points after a session ends.\nUsers ${mustMeetQuota ? 'must' : 'do not need to'} meet the time quota to get points.`,
				),
		],
	});
};
