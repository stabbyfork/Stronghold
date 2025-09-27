import { ChatInputCommandInteraction, GuildMember, roleMention } from 'discord.js';
import { constructError, defaultEmbed, getOption, reportErrorIfNotSetup, reportErrorToUser } from '../../../utils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { ErrorReplies } from '../../../types.js';
import { Data } from '../../../data.js';
import { hasPermissions, Permission } from '../../../schema.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.remove) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.ManageRanks))) return;
	const name = getOption(interaction, args, 'rank');
	const rank = await Data.models.Rank.findOne({ where: { guildId: guild.id, name } });
	if (!rank) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RankNotFoundSubstitute], name), true);
		return;
	}
	const roleId = rank.roleId;
	// May error
	Data.mainDb.transaction(async (t) => {
		for (const user of await Data.models.User.findAll({ where: { rankId: rank.rankId }, transaction: t })) {
			await Data.promoteUser(user);
		}
		await rank.destroy({ transaction: t });
	});
	await guild.roles.delete(roleId, 'Deleted by /ranking ranks remove.');
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Success')
				.setDescription(`Removed rank ${roleMention(roleId)} successfully.`)
				.setColor('Green'),
		],
	});
};
