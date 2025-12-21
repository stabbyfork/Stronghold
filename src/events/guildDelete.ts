import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Data } from '../data.js';

export default createEvent({
	name: Events.GuildDelete,
	once: false,
	execute: async (guild) => {
		console.log(`Left guild ${guild.name} (${guild.id})`);
		await Data.models.Guild.update(
			{
				dpmChannelId: null,
				dpmGame: null,
				ready: false,
				tag: null,
				logChannelId: null,
				serverInvite: null,
				guildFlags: 0,
			},
			{
				where: {
					guildId: guild.id,
				},
			},
		);
	},
});
