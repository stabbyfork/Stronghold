import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ErrorReplies } from '../../../types/errors.js';
import { reportErrorToUser, constructError, Debug } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../../utils/permissionsUtils.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { Logging } from '../../../utils/loggingUtils.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';

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
	const group = await Data.models.RoleGroup.findOne({
		where: { guildId: guild.id, name: groupName },
		include: [RoleGroupAssociations.Roles],
	});
	if (!group) {
		await reportErrorToUser(interaction, `A role group with the name \`${groupName}\` does not exist.`, true);
		return;
	}
	if (!group.roles || group.roles.length === 0) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'The specified role group has an invalid configuration with no roles included.',
			),
			true,
		);
		Debug.error(`Role group ${groupName} in guild ${guild.id} has no roles included, which is invalid.`);
		return;
	}
	const roles = await Promise.all(
		group.roles.map((r) => {
			return guild.roles.fetch(r.roleId);
		}),
	);
	const failedRoles = [] as string[];
	roles.forEach((role, index) => {
		if (!role) failedRoles.push(group.roles![index].roleId);
	});
	if (failedRoles.length > 0) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.RoleNotFoundSubstitute],
				`The following role IDs could not be found: ${failedRoles.join(', ')}`,
			),
		);
		return;
	}
	const existingRoles = roles.filter((r): r is Exclude<typeof r, null> => r !== null);
	const highestBotRole = guild.members.me?.roles.highest;
	if (!highestBotRole) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute],
				'The bot does not have any roles, which is required to manage role groups. Ensure the bot has appropriate permissions and role hierarchy to manage all the roles in this group.',
			),
		);
		return;
	}
	const highestUserRole = (interaction.member as GuildMember).roles.highest;
	if (!highestUserRole) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute],
				'You do not have any roles, which is required to manage role groups. Ensure you have appropriate permissions and role hierarchy to manage all the roles in this group.',
			),
		);
		return;
	}
	for (const role of existingRoles) {
		if (role.position >= highestBotRole.position) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.GroupHasRoleHigherThanBot]));
			return;
		}
		if (role.position >= highestUserRole.position) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.GroupHasRoleHigherThanUser]));
			return;
		}
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
					.setLabel('Confirm deletion')
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
