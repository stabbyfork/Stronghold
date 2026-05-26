import { ChatInputCommandInteraction, GuildMember, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

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
	try {
		// May error
		await Data.mainDb.transaction(async (transaction) => {
			const rankId = rank.rankId;
			await rank.destroy({ transaction });
			for (const user of await Data.models.User.findAll({ where: { mainRankId: rankId }, transaction })) {
				await Data.promoteUser(user);
			}
		});
	} catch (error) {
		await reportErrorToUser(interaction, `Failed to remove rank ${rank.name}. Error: ${error}`, true);
	}

	await interaction.reply({
		embeds: [defaultEmbed().setTitle('Success').setDescription(`Removed rank ${rank.name}.`).setColor('Green')],
	});
	Logging.quickInfo(interaction, `Removed rank ${rank.name}.`);
};
