import { Op } from '@sequelize/core';
import { ActivityType, Events } from 'discord.js';
import { setInterval } from 'timers/promises';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { createEvent } from '../types/eventTypes.js';
import { GuildFlag } from '../utils/guildFlagsUtils.js';
import { Logging } from '../utils/loggingUtils.js';
import { Debug } from '../utils/errorsUtils.js';

export default createEvent({
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Logged in as ${client.user.tag}`);
		client.user.setActivity('town', { type: ActivityType.Playing });
		for (const cmd of Object.values(commands)) {
			await cmd.once?.();
		}
		const dbGuilds = await Data.models.Guild.count();
		console.log('Started with', dbGuilds, 'guilds');
	},
});
