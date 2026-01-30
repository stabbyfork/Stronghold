import { GuildMember, userMention } from 'discord.js';
import { Data } from '../data.js';
import { Op } from '@sequelize/core';
import { RoleData } from '../models/roleData.js';
import { Logging } from './loggingUtils.js';
import { GuildFlag } from './guildFlagsUtils.js';

export namespace Prefix {
	/** Guild ID -> Role ID -> Prefix */
	export const prefixCache = new Map<string, Map<string, string>>();
	/** User ID -> Prefix */
	export const userPrefixCache = new Map<string, string>();

	Data.models.RoleData.hooks.addListener('afterDestroy', async (roleData: RoleData) => {
		if (!roleData.prefix) return;
		const guildPrefixes = prefixCache.get(roleData.guildId);
		if (!guildPrefixes) return;
		guildPrefixes.delete(roleData.roleId);
	});

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
		prefixCache.set(guildId, roleDatas);
		return roleDatas;
	}

	export async function getHighestPrefix(member: GuildMember): Promise<string | undefined> {
		const guildPrefixes = prefixCache.get(member.guild.id) ?? (await loadGuildPrefixes(member.guild.id));
		// Descending order by role position
		const memberRoles = member.roles.cache.sort((a, b) => b.position - a.position);
		for (const role of memberRoles.values()) {
			const prefix = guildPrefixes.get(role.id);
			if (prefix) {
				return prefix;
			}
		}
	}

	export async function getMemberPrefix(member: GuildMember): Promise<string | undefined> {
		const cachedPrefix = userPrefixCache.get(member.id);
		if (cachedPrefix !== undefined) return cachedPrefix;

		const prefix = await getHighestPrefix(member);
		if (prefix === undefined) {
			userPrefixCache.delete(member.id);
			return undefined;
		}
		userPrefixCache.set(member.id, prefix);
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
		const newDisplay = newPrefix ? `${newPrefix} ${noPrefixName}` : noPrefixName;
		if (newDisplay.length >= 32) {
			Logging.log({
				logType: Logging.Type.Warning,
				extents: [GuildFlag.LogWarnings],
				formatData: {
					msg: `Member ${userMention(member.id)} has a new nickname that would exceed Discord's maximum length of 32 characters. Their prefix will be removed.`,
					action: 'Member prefix update',
					userId: member.id,
				},
				data: { guildId: member.guild.id },
			});
			try {
				// Revert to no prefix name
				await member.setNickname(noPrefixName);
				userPrefixCache.delete(member.id);
			} catch (e) {
				Logging.log({
					logType: Logging.Type.Warning,
					extents: [GuildFlag.LogWarnings],
					formatData: {
						msg: `Failed to remove prefix for member ${userMention(member.id)} as the new nickname would exceed Discord's maximum length of 32 characters. The bot is possibly missing the permission to rename members (Manage Nicknames). The user may be above the bot in the role hierarchy (or might be the server owner).`,
						action: 'Member prefix removal',
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
		if (newPrefix !== undefined) {
			userPrefixCache.set(member.id, newPrefix);
		} else {
			userPrefixCache.delete(member.id);
		}
		return true;
	}
}
