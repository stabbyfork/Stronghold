import { Events, userMention } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { defaultEmbed } from '../utils/discordUtils.js';
import { Config } from '../config.js';

export default createEvent({
	name: Events.GuildCreate,
	once: false,
	async execute(guild) {
		console.log(`Joined guild: ${guild.name}`);
		await guild.fetchOwner().then((owner) =>
			owner.send({
				embeds: [
					defaultEmbed()
						.setTitle('Thanks for using Stronghold!')
						.setDescription(
							`Use \`/setup\` in the server to get started and for further instructions.\nJoin the support server or DM ${userMention(Config.get('appOwnerId'))} for help.`,
						),
				],
			}),
		);
	},
});
