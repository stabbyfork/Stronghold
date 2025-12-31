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
		const games = new Set<string>();
		for (const guild of joinedGuilds.values()) {
			const members = guild.memberCount;
			totalMembers += members;
		}
		for (const dbGuild of dbGuilds.rows) {
			if (dbGuild.dpmGame) games.add(dbGuild.dpmGame);
		}
		client.user.setActivity(games.size > 0 ? Array.from(games.values()).join(', ') : 'something', {
			type: ActivityType.Playing,
			url: Config.get('website').url,
		});
		console.log(`Total members: ${totalMembers}`);
		fs.writeFileSync(
			'guild-data.json',
			`${JSON.stringify([`In ${joinedGuilds.size} guilds, with ${totalMembers} members in total, ${dbGuilds.count} of which are set up`, ...joinedGuilds.values().map((g) => Object.assign(g, { setup: dbGuilds.rows.find((r) => r.guildId === g.id) ?? null }))], null, 2)}`,
		);
	},
});
