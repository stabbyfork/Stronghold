import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { setPointsWithInteraction } from './set.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.points.add) => {
	setPointsWithInteraction(
		interaction,
		getOption(interaction, args, 'users'),
		getOption(interaction, args, 'points'),
		(prevPoints, givenPoints) => prevPoints + givenPoints,
		(userIds, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(`Added \`${points}\` points to ${userIds.map(userMention).join(', ')} successfully.`),
		(userIds, points) => `Added ${points} points to ${userIds.map(userMention).join(', ')}`,
	);
};
