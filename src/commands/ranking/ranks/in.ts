import { ChatInputCommandInteraction, MessageFlags, userMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { ErrorReplies } from '../../../types/errors.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { RankAssociations } from '../../../models/rank.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.in) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const rankName = getOption(interaction, args, 'rank');
	const rank = await Data.models.Rank.findOne({
		where: { guildId: guild.id, name: rankName },
		include: [RankAssociations.SecondaryUsers],
	});
	if (!rank) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RankNotFoundSubstitute], rankName), true);
		return;
	}
	const users = (await Data.models.User.findAll({ where: { mainRankId: rank.rankId } })).concat(
		rank.secondaryUsers ?? [],
	);
	if (!users) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'Could not get users of rank'),
			true,
		);
		return;
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(`Users in ${rank.name}`)
				.setColor('Green')
				.setDescription(
					users.length === 0
						? 'There are no users in this rank.'
						: users.map((user) => `${userMention(user.userId)} (\`${user.points}\` points)`).join('\n'),
				),
		],
		allowedMentions: {
			users: [],
			roles: [],
		},
	});
};
