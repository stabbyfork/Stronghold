import { ChatInputCommandInteraction, GuildMember, MessageFlags, userMention } from 'discord.js';
import { constructError, defaultEmbed, getOption, reportErrorToUser } from '../../../utils.js';
import { ErrorReplies } from '../../../types.js';
import { commandOptions } from '../../../cmdOptions.js';
import { Data } from '../../../data.js';
import { Permission, PermissionBits } from '../../../schema.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.permissions.users.list) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	const user = getOption(interaction, args, 'user') ?? interaction.user;
	const permsNum =
		(await Data.models.UserPermission.findOne({ where: { guildId: guild.id, userId: user.id } }))?.permissions ?? 0;
	let perms = [] as Permission[];
	for (const perm of Object.values(Permission)) {
		if (permsNum & PermissionBits[perm]) {
			perms.push(perm);
		}
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(`Permissions for ${user.displayName} (@${user.username})`)
				.setDescription(
					`${userMention(user.id)} ${perms.length === 0 ? '**does not** have any bot permissions' : `has the bot permissions: ${perms.map((perm) => `\`${perm}\``).join(', ')}`}.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
};
