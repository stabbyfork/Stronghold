import { ChatInputCommandInteraction, GuildMember, roleMention, userMention } from 'discord.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { Prefix } from '../../../utils/prefixUtils.js';
import { Op } from '@sequelize/core';
import { CacheUtils } from '../../../utils/cacheUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.prefix.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManagePrefixes))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManagePrefixes),
			true,
		);
		return;
	}
	const role = getOption(interaction, args, 'role');
	const roleData = await Data.models.RoleData.findOne({
		where: {
			guildId: guild.id,
			roleId: role.id,
			[Op.not]: { prefix: null },
		},
	});
	if (!roleData) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.PrefixNotSetForRole], role.id), true);
		return;
	}

	await interaction.deferReply();
	await CacheUtils.fetchGuildMembers(guild);

	const members = (await guild.roles.fetch(role.id))?.members;
	if (!members) {
		await reportErrorToUser(interaction, 'Could not get role members.', true);
		return;
	}
	const failedMembers: GuildMember[] = [];
	let updatedMemberN = 0;
	await Data.mainDb.transaction(async (transaction) => {
		const roleGroups = await roleData.getRoleGroups({ transaction });
		if (roleGroups.length > 0) {
			await roleData.update({ prefix: null }, { transaction });
		} else {
			// No role groups associated, safe to delete
			await roleData.destroy({ transaction });
		}
		// Must be separated in case the user prefix cache has not been updated
		const prevPrefixes = new Map(
			await Promise.all(members.map(async (mem) => [mem.id, await Prefix.getMemberPrefix(mem)] as const)),
		);
		const guildPrefixes = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		guildPrefixes.delete(role.id);
		for (const [, member] of members) {
			const hasUpdated = await Prefix.updateMemberPrefix(
				member,
				prevPrefixes.get(member.id),
				await Prefix.getHighestPrefix(member),
			);
			if (!hasUpdated) {
				failedMembers.push(member);
				continue;
			}
		}
		updatedMemberN++;
	});

	if (failedMembers.length > 0) {
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Error updating member prefixes')
					.setDescription(
						`An error occurred while updating prefixes for member(s) (${failedMembers.map((member) => userMention(member.user.id)).join(', ')}) of role ${roleMention(role.id)}. Check logs for details.\nTo retry updating their prefixes, add the prefix back and repeat this command.\nThe rest of the members' prefixes have been updated.`,
					)
					.setColor('Red'),
			],
			allowedMentions: { roles: [], users: [] },
		});
	} else {
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Prefix removed')
					.setDescription(
						`Successfully removed prefix for role ${roleMention(role.id)} (${role.id}). Updated prefixes for ${updatedMemberN} member(s), out of ${members.size} total member(s).`,
					)
					.setColor('Green'),
			],
			allowedMentions: { roles: [], users: [] },
		});
	}
	Logging.quickInfo(interaction, `Removed prefix for role ${roleMention(role.id)} (${role.id}).`);
};
