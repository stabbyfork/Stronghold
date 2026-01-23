import { ChatInputCommandInteraction, ContainerBuilder, TextDisplayBuilder, userMention } from 'discord.js';
import { Data } from '../../../data.js';
import { RoleGroupAssociations } from '../../../models/roleGroup.js';
import { ErrorReplies } from '../../../types/errors.js';
import { defaultEmbed, Pages } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { UserAssociations } from '../../../models/user.js';
import { commandOptions } from '../../../cmdOptions.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.ranking.groups.get) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const user = getOption(interaction, args, 'user') ?? interaction.user;
	const dbUser = await Data.models.User.findOne({
		where: { guildId: guild.id, userId: user.id },
		include: [UserAssociations.RoleGroups],
	});
	const roleGroups = dbUser?.roleGroups ?? [];
	if (roleGroups.length === 0) {
		await interaction.reply({
			embeds: [defaultEmbed().setDescription(`User has no role groups assigned.`).setColor('Yellow')],
			allowedMentions: { users: [], roles: [] },
		});
		return;
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle(`Role groups for ${user.tag}`)
				.setDescription(
					`${userMention(user.id)} has the following role group${roleGroups.length !== 1 ? 's' : ''} assigned:\n${roleGroups
						.map((rg) => `**- ${rg.name}**`)
						.join('\n')}`,
				)
				.setColor('Green'),
		],
		allowedMentions: { users: [], roles: [] },
	});
};
