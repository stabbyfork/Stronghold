import { ChatInputCommandInteraction, Collection, GuildMember, roleMention, userMention } from 'discord.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { Prefix } from '../../../utils/prefixUtils.js';
import { CacheUtils } from '../../../utils/cacheUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.prefix.add) => {
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
	const prefix = getOption(interaction, args, 'prefix');
	if (prefix.length > 16) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.PrefixTooLong]), true);
		return;
	}
	if (prefix.length === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.PrefixEmpty]), true);
		return;
	}
	await interaction.deferReply();
	await CacheUtils.fetchGuildMembers(guild);
	const members = (await guild.roles.fetch(role.id))?.members;
	if (!members) {
		await reportErrorToUser(interaction, 'Could not get role members.', true);
		return;
	}

	let totalMembersToUpdate = 0;
	let updatedMemberN = 0;
	const failedMembers: GuildMember[] = [];
	await Data.mainDb.transaction(async (transaction) => {
		// Must be separated in case the user prefix cache has not been updated
		const prevPrefixes = new Map(
			await Promise.all(members.map(async (mem) => [mem.id, await Prefix.getMemberPrefix(mem)] as const)),
		);
		const [roleData, created] = await Data.models.RoleData.findCreateFind({
			where: {
				guildId: guild.id,
				roleId: role.id,
			},
			defaults: {
				guildId: guild.id,
				roleId: role.id,
				prefix,
			},
			transaction,
		});
		if (!created) {
			roleData.prefix = prefix;
			await roleData.save({ transaction });
		}
		const guildPrefixes = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		guildPrefixes.set(role.id, prefix);
		for (const [, member] of members) {
			if (member.user.bot) continue;
			const oldPrefix = prevPrefixes.get(member.id);
			const highestPrefix = await Prefix.getHighestPrefix(member);
			if (highestPrefix === oldPrefix) continue;
			else totalMembersToUpdate++;
			const hasUpdatedToNew = await Prefix.updateMemberPrefix(member, oldPrefix, highestPrefix);
			if (!hasUpdatedToNew) {
				failedMembers.push(member);
				continue;
			}
			updatedMemberN++;
		}
	});

	if (failedMembers.length > 0) {
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Prefix update partially failed')
					.setDescription(
						`Failed to update prefix for member(s) ${failedMembers.map((member) => userMention(member.user.id)).join(', ')}.\nTo retry, remove the prefix and repeat this command.\nThe rest of the members' prefixes have been updated.\nPossible reasons include the bot being below the users' highest roles.`,
					)
					.setColor('Red'),
			],
			allowedMentions: { users: [], roles: [] },
		});
	} else {
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Prefix set')
					.setDescription(
						`Successfully set prefix for role ${roleMention(role.id)} to \`${prefix}\`. Updated prefixes for ${updatedMemberN} member(s), out of ${totalMembersToUpdate} to be updated (${members.size} total members).`,
					)
					.setColor('Green'),
			],
			allowedMentions: { users: [], roles: [] },
		});
	}
	Logging.quickInfo(
		interaction,
		`Set prefix for role ${role.id} to \`${prefix}\`. Updated prefixes for ${updatedMemberN} member(s), out of ${totalMembersToUpdate} to be updated (${members.size} total members).`,
	);
};
