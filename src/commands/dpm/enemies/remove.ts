import { ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { changeRelation, DPM, isDiploReady } from '../../../utils/diplomacyUtils.js';
import { ChangeType } from '../../../types/diplomacyTypes.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { GuildRelation } from '../../../models/relatedGuild.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.enemies.remove) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await isDiploReady(interaction.guild))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.DiploNotSetup]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	if (!(await hasPermissions(member, guild, true, Permission.ManageRelations))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRelations),
			true,
		);
		return;
	}
	const tag = getOption(interaction, args, 'tag').toLowerCase();
	const target = await DPM.tagToGuild(tag);
	if (!target) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GuildTagNotFound], tag), true);
		return;
	}
	const message = getOption(interaction, args, 'message');
	try {
		await DPM.transaction(
			{
				source: guild,
				target,
			},
			DPM.TransactionType.NeutralQuery,
			{
				author: interaction.user,
				message: message ?? 'No message provided.',
			},
		);
	} catch (e) {
		if (e instanceof Errors.DPMError) {
			await reportErrorToUser(interaction, e.message, true);
			return;
		} else {
			throw e;
		}
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Peace request sent')
				.setDescription(`Sent a peace request to \`${tag}\`.`)
				.setColor('Green'),
		],
		flags: MessageFlags.Ephemeral,
	});
};
