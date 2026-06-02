import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Prefix } from '../utils/prefixUtils.js';

export default createEvent({
	name: Events.GuildMemberUpdate,
	once: false,
	async execute(oldMember, newMember) {
		if (oldMember.roles.cache.size === newMember.roles.cache.size /* || newMember.user.bot*/) {
			// Roles have not changed or member is a bot
			return;
		}
		const guild = newMember.guild;
		let prefixCache = Prefix.rolePrefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		if (prefixCache.size === 0) {
			// No prefixes set up for this guild
			return;
		}
		const newRoles = newMember.roles.cache.sorted((a, b) => b.position - a.position);
		const prevPrefix = await Prefix.getMemberPrefix(newMember, oldMember.roles.cache);
		console.log(`Member ${newMember.user.tag} roles updated. Previous prefix: ${prevPrefix ?? 'None'}`);
		for (const role of newRoles.values()) {
			const prefix = prefixCache.get(role.id);
			if (prefix) {
				console.log(`New prefix: ${prefix} (from role ${role.name})`);
				if (prevPrefix === prefix) {
					// Prefix is the same as before, no need to update
					return;
				}
				await Prefix.updateMemberPrefix(newMember, prevPrefix, prefix);
				return;
			}
		}
		if (prevPrefix) {
			console.log(`Removing prefix: ${prevPrefix}`);
			await Prefix.updateMemberPrefix(newMember, prevPrefix, undefined);
			return;
		}
	},
});
