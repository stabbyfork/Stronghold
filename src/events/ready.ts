import { ActivityType, Events } from 'discord.js';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { createEvent } from '../types/eventTypes.js';
import fs from 'fs';
import { Config } from '../config.js';

export default createEvent({
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Logged in as ${client.user.tag}`);
		for (const cmd of Object.values(commands)) {
			await cmd.once?.();
		}
		const dbGuilds = await Data.models.Guild.findAndCountAll();
		const joinedGuilds = client.guilds.cache;
		console.log('Started with', dbGuilds.count, 'set-up guilds and', joinedGuilds.size, 'total guilds');
		let totalMembers = 0;
		// Name - frequency
		const games = new Map<string, number>();
		for (const guild of joinedGuilds.values()) {
			const members = guild.memberCount;
			totalMembers += members;
		}
		for (const dbGuild of dbGuilds.rows) {
			if (dbGuild.dpmGame) games.set(dbGuild.dpmGame, (games.get(dbGuild.dpmGame) ?? 0) + 1);
		}
		const gamesArr = Array.from(games.entries()).sort((a, b) => b[1] - a[1]);
		if (gamesArr.length > 0) {
			client.user.setActivity(
				gamesArr.length > 3
					? `${gamesArr.slice(0, 3).join(', ')} and ${gamesArr.length - 3} others`
					: gamesArr.join(', '),
				{
					type: ActivityType.Playing,
					url: Config.get('website').url,
				},
			);
		}

		console.log(`Total members: ${totalMembers}`);
		fs.writeFileSync(
			'guild-data.json',
			`${JSON.stringify([`In ${joinedGuilds.size} guilds, with ${totalMembers} members in total, ${dbGuilds.count} of which are set up`, ...joinedGuilds.values().map((g) => Object.assign(g, { setup: dbGuilds.rows.find((r) => r.guildId === g.id) ?? null }))], null, 2)}`,
		);
	},
});
