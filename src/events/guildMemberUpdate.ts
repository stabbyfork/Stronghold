import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { Prefix } from '../utils/prefixUtils.js';

export default createEvent({
	name: Events.GuildMemberUpdate,
	once: false,
	async execute(oldMember, newMember) {
		if (oldMember.roles.cache.size === newMember.roles.cache.size) {
			console.log('GuildMemberUpdate roles unchanged');
			// Roles have not changed
			return;
		}
		const newRoles = newMember.roles.cache.sorted((a, b) => b.position - a.position);
		console.log(
			'GuildMemberUpdate roles changed:',
			newRoles.map((r) => r.name),
		);
		const guild = newMember.guild;
		let prefixCache = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		const prevPrefix = await Prefix.getMemberPrefix(newMember);
		console.log('Previous prefix:', prevPrefix);

		for (const role of newRoles.values()) {
			const prefix = prefixCache.get(role.id);
			if (prefix) {
				console.log('New prefix:', prefix);
				await Prefix.updateMemberPrefix(newMember, prevPrefix, prefix);
				return;
			}
		}
		if (prevPrefix) {
			console.log('No prefix found, removing previous prefix');
			await Prefix.updateMemberPrefix(newMember, prevPrefix, undefined);
			return;
		}
	},
});
