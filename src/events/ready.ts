import { ActivityType, Events } from 'discord.js';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { createEvent } from '../types/eventTypes.js';
import fs from 'fs';

export default createEvent({
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Logged in as ${client.user.tag}`);
		client.user.setActivity('town', { type: ActivityType.Playing });
		for (const cmd of Object.values(commands)) {
			await cmd.once?.();
		}
		const dbGuilds = await Data.models.Guild.findAndCountAll();
		const joinedGuilds = client.guilds.cache;
		console.log('Started with', dbGuilds.count, 'set-up guilds and', joinedGuilds.size, 'total guilds');
		let totalMembers = 0;
		for (const guild of joinedGuilds.values()) {
			const members = guild.memberCount;
			totalMembers += members;
		}
		console.log(`Total members: ${totalMembers}`);
		fs.writeFileSync(
			'guild-data.json',
			`In ${joinedGuilds.size} guilds, with ${totalMembers} members in total, ${dbGuilds.count} of which are set up:\n${JSON.stringify([...joinedGuilds.values().map((g) => Object.assign(g, { setup: dbGuilds.rows.find((r) => r.guildId === g.id) }))], null, 2)}`,
		);
	},
});
