import { Collection, GuildMember, Role, userMention } from 'discord.js';
import { Data } from '../data.js';
import { Op } from 'sequelize';
import { RoleData } from '../models/roleData.js';
import { Logging } from './loggingUtils.js';
import { GuildFlag } from './guildFlagsUtils.js';
import { CacheUtils } from './cacheUtils.js';

export namespace Prefix {
	/** Guild ID -> Role ID -> Prefix */
	export const rolePrefixCache = new Map<string, Map<string, string>>();
	/** Guild ID -> User ID -> Prefix */
	export const userPrefixCache = new Map<string, Map<string, string>>();

	export async function loadGuildPrefixes(guildId: string) {
		const roleDatas = new Map(
			(
				await Data.models.RoleData.findAll({
					where: {
						guildId,
						prefix: {
							[Op.not]: null,
						},
					},
				})
			).map((rd) => [rd.roleId, rd.prefix!] as const),
		);
		rolePrefixCache.set(guildId, roleDatas);
		return roleDatas;
	}

	export async function getHighestPrefix(
		member: GuildMember,
		roles?: Collection<string, Role>,
	): Promise<string | undefined> {
		const guildPrefixes = rolePrefixCache.get(member.guild.id) ?? (await loadGuildPrefixes(member.guild.id));
		if (!CacheUtils.areGuildMembersCached(member.guild.id)) {
			await CacheUtils.fetchGuildMembers(member.guild);
		}
		// Descending order by role position
		const memberRoles =
			roles?.sort((a, b) => b.position - a.position) ??
			member.roles.cache.sort((a, b) => b.position - a.position);
		for (const role of memberRoles.values()) {
			const prefix = guildPrefixes.get(role.id);
			if (prefix) {
				return prefix;
			}
		}
	}

	export async function getMemberPrefix(
		member: GuildMember,
		roles?: Collection<string, Role>,
	): Promise<string | undefined> {
		const userPrefixes = userPrefixCache.get(member.guild.id);
		const cachedPrefix = userPrefixes?.get(member.id);
		if (cachedPrefix !== undefined) return cachedPrefix;

		const prefix = await getHighestPrefix(member, roles);
		if (prefix === undefined) {
			userPrefixes?.delete(member.id);
			return undefined;
		}
		userPrefixes?.set(member.id, prefix);
		return prefix;
	}

	export async function updateMemberPrefix(
		member: GuildMember,
		oldPrefix?: string,
		newPrefix?: string,
	): Promise<boolean> {
		const oldDisplay = member.nickname ?? member.user.displayName;
		let noPrefixName = oldDisplay;
		if (oldPrefix && oldDisplay.startsWith(oldPrefix)) {
			noPrefixName = oldDisplay.slice(oldPrefix.length).trim();
		}
		if (newPrefix && noPrefixName.startsWith(newPrefix)) {
			// New prefix is already present, no need to update
			const userPrefixes = userPrefixCache.get(member.guild.id);
			if (!userPrefixes) {
				userPrefixCache.set(member.guild.id, new Map([[member.id, newPrefix]]));
			} else if (!userPrefixes.has(member.id)) {
				userPrefixes.set(member.id, newPrefix);
			}
			return true;
		}
		const newDisplay = newPrefix ? `${newPrefix} ${noPrefixName}` : noPrefixName;
		if (newDisplay.length > 32) {
			Logging.log({
				logType: Logging.Type.Warning,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					msg: `Member ${userMention(member.id)} has a new nickname that would exceed Discord's maximum length of 32 characters. Their prefix will be removed.`,
					action: 'Member prefix update',
					cause: `New nickname would be "${newDisplay}" with length ${newDisplay.length}`,
					userId: member.id,
				},
				data: { guildId: member.guild.id },
			});
			try {
				// Revert to no prefix name
				await member.setNickname(noPrefixName);
				const userPrefixes = userPrefixCache.get(member.guild.id);
				userPrefixes?.delete(member.id);
			} catch (e) {
				Logging.log({
					logType: Logging.Type.Warning,
					extents: [GuildFlag.LogWarnings],
					formatData: {
						msg: `Failed to remove prefix for member ${userMention(member.id)} as the new nickname would exceed Discord's maximum length of 32 characters. The bot is possibly missing the permission to rename members (Manage Nicknames). The user may be above the bot in the role hierarchy (or might be the server owner).`,
						action: 'Member prefix update -> reset prefix',
						cause: (e as Error).message,
						userId: member.id,
					},
					data: { guildId: member.guild.id },
				});
			}

			// Can't update nickname, would exceed max length
			return false;
		}
		try {
			await member.setNickname(newDisplay);
		} catch (e) {
			Logging.log({
				logType: Logging.Type.Warning,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					msg: `Failed to update prefix for member ${userMention(member.id)}. The bot is possibly missing the permission to rename members (Manage Nicknames). The user may be above the bot in the role hierarchy (or might be the server owner).`,
					action: 'Member prefix update',
					cause: (e as Error).message,
					userId: member.id,
				},
				data: { guildId: member.guild.id },
			});
			return false;
		}
		const userPrefixes = userPrefixCache.get(member.guild.id);
		if (newPrefix !== undefined) {
			userPrefixes?.set(member.id, newPrefix);
		} else {
			userPrefixes?.delete(member.id);
		}
		return true;
	}
}
