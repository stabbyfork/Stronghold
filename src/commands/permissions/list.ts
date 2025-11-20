import { APIEmbedField, ChatInputCommandInteraction, RestOrArray } from 'discord.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { Permission } from '../../utils/permissionsUtils.js';

const fields = [
	{
		name: Permission.Administrator,
		value: 'Basically grants access to everything bot-related, except removing and adding this permission; only the server owner can do that.',
		inline: true,
	},
	{
		name: Permission.NoInactivityKick,
		value: 'Users with this permission will not be kicked for inactivity.',
		inline: true,
	},
	{
		name: Permission.ManageActivityChecks,
		value: 'Users with this permission can manage (add/remove/edit) activity checks.',
		inline: true,
	},
	{
		name: Permission.ManagePermissions,
		value: 'Users with this permission can manage (add/remove) BOT-SPECIFIC (**NOT DISCORD/SERVER**) permissions of roles and users (NOT themselves), EXCEPT removing or adding administrator and this permission.',
		inline: true,
	},
	{
		name: Permission.ManagePoints,
		value: 'Users with this permission can manage (add/remove) points.',
		inline: true,
	},
	{
		name: Permission.ManageRanks,
		value: 'Users with this permission can manage (add/remove) ranks.',
		inline: true,
	},
	{
		name: Permission.ManageSessions,
		value: 'Users with this permission can manage (add/remove) sessions.',
		inline: true,
	},
	{
		name: Permission.ManageRelations,
		value: 'Users with this permission can manage (add/remove) relations (allies, enemies, peace, etc.).',
		inline: true,
	},
	{
		name: Permission.DiplomacyMessages,
		value: 'Users with this permission can send messages to other guilds via the diplomacy system (see `/dpm setup`).',
		inline: true,
	},
] as const as RestOrArray<APIEmbedField>;

export default async (interaction: ChatInputCommandInteraction) => {
	interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('All available permissions')
				.setDescription(
					`The list of all permissions available (specific to this bot). These can be referenced in commands:\n${Object.values(
						Permission,
					)
						.map((perm) => `\`${perm}\``)
						.join('\n')}`,
				)
				.setFields(...fields),
		],
	});
};
