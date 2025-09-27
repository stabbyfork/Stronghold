import { ChatInputCommandInteraction, GuildMember, MessageFlags, roleMention } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { ErrorReplies, Errors } from '../../../types.js';
import { constructError, defaultEmbed, getOption, reportErrorIfNotSetup, reportErrorToUser } from '../../../utils.js';
import { hasPermissions, Permission } from '../../../schema.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.ranks.edit) => {
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
	const name = getOption(interaction, args, 'name');
	const rank = await Data.models.Rank.findOne({ where: { guildId: guild.id, name } });
	if (!rank) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.RankNotFoundSubstitute], name), true);
		return;
	}
	const newLimit = getOption(interaction, args, 'limit');
	const newName = getOption(interaction, args, 'new_name');
	const newPoints = getOption(interaction, args, 'points');
	try {
		await Data.mainDb.transaction(async (transaction) => {
			const usersInRank = await Data.models.User.findAll({
				where: { rankId: rank.rankId },
				transaction,
			});
			if (newLimit) {
				if (usersInRank.length > newLimit) {
					await reportErrorToUser(
						interaction,
						`You cannot set a limit lower than the number of users in the rank (${usersInRank.length}).`,
						true,
					);
					throw new Errors.ExpectedError('Limit too low');
				}
			}
			await rank.update(
				{
					name: newName ?? rank.name,
					pointsRequired: newPoints ?? rank.pointsRequired,
					userLimit: newLimit ?? rank.userLimit,
				},
				{ transaction },
			);
			await Promise.all(
				usersInRank.map(async (user) => {
					await Data.promoteUser(user, transaction);
				}),
			);
		});
	} catch (e) {
		if (e instanceof Errors.ExpectedError) return;
		else throw e;
	}

	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Success')
				.setDescription(`Edited rank ${roleMention(rank.roleId)} successfully.`)
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
