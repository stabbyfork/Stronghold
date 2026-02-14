import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Prefix } from '../utils/prefixUtils.js';

export default createEvent({
	name: Events.GuildMemberUpdate,
	once: false,
	async execute(oldMember, newMember) {
		if (oldMember.roles.cache.size === newMember.roles.cache.size || newMember.user.bot) {
			// Roles have not changed or member is a bot
			return;
		}
		const newRoles = newMember.roles.cache.sorted((a, b) => b.position - a.position);
		const guild = newMember.guild;
		let prefixCache = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		const prevPrefix = await Prefix.getMemberPrefix(newMember);

		for (const role of newRoles.values()) {
			const prefix = prefixCache.get(role.id);
			if (prefix) {
				await Prefix.updateMemberPrefix(newMember, prevPrefix, prefix);
				return;
			}
		}
		if (prevPrefix) {
			await Prefix.updateMemberPrefix(newMember, prevPrefix, undefined);
			return;
		}
	},
});
