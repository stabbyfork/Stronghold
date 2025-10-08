import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { changeRelation, ChangeType, isDiploReady } from '../../../utils/diplomacyUtils.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError } from '../../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { getOption } from '../../../utils/subcommandsUtils.js';
import { GuildRelation } from '../../../models/relatedGuild.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { commandOptions } from '../../../cmdOptions.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.enemies.add) => {
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
	if (
		await changeRelation({
			interaction,
			relationTag: tag,
			changeType: ChangeType.Add,
			newRelation: GuildRelation.Enemy,
		})
	) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Enemy added')
					.setDescription(`You are now enemies with \`${tag}\`.`)
					.setColor('Green'),
			],
		});
	}
};
