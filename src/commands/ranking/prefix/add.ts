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
	await Data.mainDb.transaction(async (transaction) => {
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

		// Owner and bot are always cached, so check for <= 2
		if (guild.members.cache.size <= 2) {
			await guild.members.fetch();
		}
		const members = Array.from(role.members.values());
		// Must be separated in case the user prefix cache has not been updated
		const prevPrefixes = await Promise.all(members.map(async (mem) => await Prefix.getMemberPrefix(mem)));
		const guildPrefixes = Prefix.prefixCache.get(guild.id) ?? (await Prefix.loadGuildPrefixes(guild.id));
		guildPrefixes.set(role.id, prefix);
		for (let i = 0; i < members.length; i++) {
			const member = members[i];
			const oldPrefix = prevPrefixes[i];
			const highestPrefix = await Prefix.getHighestPrefix(member);
			if (highestPrefix === oldPrefix) continue;
			await Prefix.updateMemberPrefix(member, oldPrefix, await Prefix.getHighestPrefix(member));
		}
	});

	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Prefix set')
				.setDescription(`Successfully set prefix for role ${roleMention(role.id)} to \`${prefix}\`.`)
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, `Set prefix for role ${role.id} to \`${prefix}\`.`);
};
