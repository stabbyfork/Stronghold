import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';
import { DPM, isDiploReady } from '../../../utils/diplomacyUtils.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.allies.add) => {
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
			DPM.TransactionType.AllyRequest,
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
				.setTitle('Ally request sent')
				.setDescription(`Sent an ally request to \`${tag}\`.`)
				.setColor('Green'),
		],
	});
};
