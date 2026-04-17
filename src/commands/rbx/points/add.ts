import { ChatInputCommandInteraction } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { setRbxPoints } from './set.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.points.add) => {
	setRbxPoints(
		interaction,
		getOption(interaction, args, 'names'),
		getOption(interaction, args, 'points'),
		(prevPoints, givenPoints) => prevPoints + givenPoints,
		(users, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Added \`${points}\` point${points === 1 ? '' : 's'} to:\n${users.map((u) => `- \`${u.name}\``).join(',\n')}\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
				),
		(users, points) =>
			`Added ${points} point${points === 1 ? '' : 's'} to:\n${users.map((u) => `\`${u.displayName}\` (\`${u.name}\`/\`${u.id}\`)`).join(',\n')}\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
	);
};
