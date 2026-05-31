import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Data } from '../../../data.js';
import { Op } from 'sequelize';
import { Logging } from '../../../utils/loggingUtils.js';
import { RbxUtils } from '../../../utils/robloxUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (interaction.user.id !== guild.ownerId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.MustBeServerOwner]), true);
		return;
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Exporting points')
				.setDescription('Creating a CSV file for Roblox points, please wait...')
				.setColor('Yellow'),
		],
		flags: MessageFlags.Ephemeral,
	});
	const pointsCount = await Data.models.RobloxUser.count({ where: { guildId: guild.id } });
	const pointsData = await Data.models.RobloxUser.findAll({
		where: { guildId: guild.id, points: { [Op.gt]: 0 } },
		attributes: ['guildId', 'userId', 'points'],
		limit: 10001,
	});
	if (pointsCount === 0) {
		await interaction.editReply({
			embeds: [
				defaultEmbed()
					.setTitle('No points data')
					.setDescription('There are no Roblox users with points in this server, so no CSV file was created.')
					.setColor('Red'),
			],
		});
		return;
	}
	if (pointsCount > 10000) {
		await interaction.editReply({
			embeds: [
				defaultEmbed()
					.setTitle('Too much data')
					.setDescription(
						'There are too many Roblox users with points in this server to export (over 10,000). Please contact support to request a manual export of the data (use /feedback or join the support server).',
					)
					.setColor('Red'),
			],
		});
		return;
	}
	const robloxUserNames = new Map(
		(await RbxUtils.idsToData(...pointsData.map((p) => Number(p.userId)))).map((u) => [u.id, u.name]),
	);
	const csvContent =
		'Username,User ID,Points\n' +
		pointsData
			.map((row) => `${robloxUserNames.get(Number(row.userId)) ?? '???'},${row.userId},${row.points}`)
			.join('\n');
	const buffer = Buffer.from(csvContent, 'utf-8');
	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Export complete')
				.setDescription(
					'The CSV file for Roblox points has been created.\nThis can be imported into spreadsheet software like Excel or Google Sheets. Users with 0 (or fewer) points have been excluded from the export.',
				)
				.setColor('Green'),
		],
	});
	await interaction.followUp({
		content: 'Find the CSV file attached below:',
		files: [{ attachment: buffer, name: `roblox_points_${guild.id}.csv` }],
		flags: MessageFlags.Ephemeral,
	});
	Logging.quickInfo(interaction, `Exported points data for ${pointsCount} Roblox users.`);
};
