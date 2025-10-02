import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Data } from '../data.js';

export default createEvent({
	name: Events.GuildMemberAdd,
	once: false,
	execute: async (member) => {
		const guild = member.guild;
		const dbUser = await Data.models.User.findOne({
			where: { guildId: guild.id, userId: member.id },
		});
		if (!dbUser) return;
		await Data.promoteUser(dbUser);
	},
});
