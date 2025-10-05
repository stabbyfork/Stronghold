import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { Data } from '../../data.js';
import { defaultEmbed } from '../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const usr = interaction.member as GuildMember | null;
	if (!usr) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(usr, guild, true, Permission.ManageRanks))) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.PermissionError, ErrorReplies.PermissionsNeededSubstitute],
				Permission.ManageRanks,
			),
			true,
		);
		return;
	}
	await Data.mainDb.transaction(async (transaction) => {
		const dbMembers = await Data.models.User.findAll({ where: { guildId: guild.id }, transaction });
		for (const user of dbMembers) {
			await Data.promoteUser(user, transaction);
		}
	});
	await interaction.reply({
		embeds: [defaultEmbed().setTitle('Success').setDescription('Promoted all users.').setColor('Green')],
	});
};
