import { ActivityType, Events } from 'discord.js';
import { createEvent } from '../types.js';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { Op } from '@sequelize/core';
import { setInterval } from 'timers/promises';
import { Logging } from '../utils.js';
import { GuildFlag } from '../schema.js';

export default createEvent({
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Logged in as ${client.user.tag}`);
		client.user.setActivity('town', { type: ActivityType.Playing });
		for (const cmd of Object.values(commands)) {
			await cmd.once?.();
		}
		const dbGuilds = await Data.models.Guild.findAll({
			where: { logChannelId: { [Op.ne]: null } },
			attributes: ['logChannelId'],
		});
		const gen = (function* () {
			for (const guild of dbGuilds) {
				if (guild.logChannelId) yield guild;
			}
		})();
		for await (const _ of setInterval(10000)) {
			const next = gen.next();
			if (next.done) return;
			const guild = next.value;
			await Logging.log({
				data: {
					guildId: guild.guildId,
				},
				logType: Logging.Type.Info,
				extents: [GuildFlag.LogInfo],
				formatData: 'Bot has started',
			});
		}
	},
});
