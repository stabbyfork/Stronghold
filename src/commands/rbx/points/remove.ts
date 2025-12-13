import { ChatInputCommandInteraction } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { setRbxPoints } from './set.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.points.remove) => {
	setRbxPoints(
		interaction,
		getOption(interaction, args, 'names'),
		getOption(interaction, args, 'points'),
		(prevPoints, givenPoints) => prevPoints - givenPoints,
		(users, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Removed \`${points}\` point${points === 1 ? '' : 's'} from ${users.map((u) => `\`${u.name}\``).join(', ')}.`,
				),
		(users, points) =>
			`Removed ${points} point${points === 1 ? '' : 's'} from ${users.map((u) => `\`${u.displayName}\` (\`${u.name}\`/\`${u.id}\`)`).join(', ')}`,
	);
};
