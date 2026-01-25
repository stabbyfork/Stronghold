import { ChatInputCommandInteraction, GuildMember, roleMention } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { Prefix } from '../../../utils/prefixUtils.js';

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
		},
	});
	if (!roleData?.prefix) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.PrefixNotSetForRole], role.id), true);
		return;
	}

	await interaction.deferReply();
	await Data.mainDb.transaction(async (transaction) => {
		const roleGroups = await roleData.getRoleGroups({ transaction });
		if (roleGroups.length > 0) {
			await roleData.update({ prefix: null }, { transaction });
		} else {
			// No role groups associated, safe to delete
			await roleData.destroy({ transaction });
		}
		if (guild.members.cache.size <= 2) {
			await guild.members.fetch();
		}
		const members = Array.from(role.members.values());
		// Must be separated in case the user prefix cache has not been updated
		const prevPrefixes = await Promise.all(members.map(async (mem) => await Prefix.getMemberPrefix(mem)));
		const guildPrefixes = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		guildPrefixes.delete(role.id);
		for (let i = 0; i < members.length; i++) {
			const member = members[i];
			await Prefix.updateMemberPrefix(member, prevPrefixes[i], await Prefix.getHighestPrefix(member));
		}
	});

	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Prefix removed')
				.setDescription(`Successfully removed prefix for role ${roleMention(role.id)} (${role.id}).`)
				.setColor('Green'),
		],
		allowedMentions: { roles: [], users: [] },
	});
	Logging.quickInfo(interaction, `Removed prefix for role ${roleMention(role.id)} (${role.id}).`);
};
