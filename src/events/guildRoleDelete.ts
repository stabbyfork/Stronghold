import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Data } from '../data.js';

export default createEvent({
	name: Events.GuildRoleDelete,
	once: false,
	async execute(role) {
		await Data.models.RoleData.destroy({
			where: {
				guildId: role.guild.id,
				roleId: role.id,
			},
		});
	},
});
