import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError, Debug } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';

const enum CustomIds {
	ConfirmDelete = 'confirm_delete',
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.delete) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageRoleGroups))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageRoleGroups),
			true,
		);
		return;
	}

	const groupName = getOption(interaction, args, 'group_name');
	if (!groupName) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.GroupNameEmpty]), true);
		return;
	}
	const group = await Data.models.RoleGroup.findOne({ where: { guildId: guild.id, name: groupName } });
	if (!group) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` does not exist.`, true);
		return;
	}
	const reply = await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Confirmation')
				.setDescription(
					`Are you sure you want to delete the role group \`${groupName}\`? **This action cannot be undone.**\nRoles associated with this group will remain unaffected, and will not removed from anyone. Use \`/ranking groups remove\` to remove the group from users if needed.`,
				)
				.setColor('Yellow'),
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(CustomIds.ConfirmDelete)
					.setLabel('Confirm Deletion')
					.setStyle(ButtonStyle.Danger),
			),
		],
		withResponse: true,
	});
	try {
		const intr = await reply.resource?.message?.awaitMessageComponent({
			filter: (i) => i.user.id === interaction.user.id && i.customId === CustomIds.ConfirmDelete,
			time: 60000,
		});
		await intr?.deferUpdate();
	} catch (e) {
		await interaction.editReply({
			embeds: [
				defaultEmbed().setTitle('Timed out').setDescription('Role group deletion timed out.').setColor('Red'),
			],
			components: [],
		});
		Debug.error('Error awaiting message component for role group deletion confirmation:', e);
		return;
	}

	await group.destroy();
	await interaction.followUp({
		embeds: [
			defaultEmbed()
				.setTitle('Role group deleted')
				.setDescription(
					`The role group \`${groupName}\` has been deleted successfully. Roles remain unaffected (were not deleted or removed).`,
				)
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, `Deleted role group \`${groupName}\`.`);
};
