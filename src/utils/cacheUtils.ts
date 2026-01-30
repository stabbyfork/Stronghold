import { Guild } from 'discord.js';

export namespace CacheUtils {
	/** Guild ID -> whether guild members are cached */
	const guildMembersCachedCache = new Map<string, boolean>();
	export function areGuildMembersCached(guildId: string): boolean {
		return guildMembersCachedCache.get(guildId) ?? false;
	}

	export function setGuildMembersCached(guildId: string, cached: boolean) {
		guildMembersCachedCache.set(guildId, cached);
	}

	export async function fetchGuildMembers(guild: Guild) {
		if (CacheUtils.areGuildMembersCached(guild.id)) {
			return guild.members.cache;
		} else {
			CacheUtils.setGuildMembersCached(guild.id, true);
			return await guild.members.fetch();
		}
	}
}
