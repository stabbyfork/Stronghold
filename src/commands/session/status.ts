import { ChatInputCommandInteraction, time, TimestampStyles } from 'discord.js';
import { constructError, defaultEmbed, reportErrorIfNotSetup, reportErrorToUser } from '../../utils.js';
import { ErrorReplies } from '../../types.js';
import { Data } from '../../data.js';
import ms from 'ms';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}

	const session = await Data.models.GuildSession.findOne({ where: { guildId: guild.id } });
	const toReply = defaultEmbed()
		.setTitle('Session status')
		.setColor(session?.active ? 'Green' : 'Red')
		.setDescription(`A session is **${session?.active ? 'active' : 'not active'}**.`);
	if (session && session.active) {
		toReply.addFields([
			{ name: 'Started', value: `${time(session.startedAt!, TimestampStyles.RelativeTime)}`, inline: true },
			{
				name: 'Duration',
				value: `${ms(Date.now() - session.startedAt!.getTime(), { long: true })}`,
				inline: true,
			},
		]);
	} else if (session) {
		toReply.addFields([
			{ name: 'Ended', value: `${time(session.endedAt!, TimestampStyles.RelativeTime)}`, inline: true },
			{
				name: 'Duration',
				value: `${ms((session.endedAt ? session.endedAt.getTime() : Date.now()) - session.startedAt!.getTime(), { long: true })}`,
				inline: true,
			},
		]);
	}

	await interaction.reply({ embeds: [toReply] });
};
