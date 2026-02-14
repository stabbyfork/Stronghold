import { ChatInputCommandInteraction, userMention } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { reportErrorToUser } from '../../utils/errorsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.set.bot_pfp) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, 'This command can only be used in a server.', true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const user = interaction.user;
	if (user.id !== guild.ownerId) {
		await reportErrorToUser(interaction, ErrorReplies.MustBeServerOwner, true);
		return;
	}

	const image = getOption(interaction, args, 'image');
	await interaction.deferReply();
	if (!image) {
		await guild.members.editMe({
			avatar: null,
			reason: `Custom profile picture removed by ${interaction.user.username} (${interaction.user.id})`,
		});
		await interaction.editReply({
			embeds: [
				defaultEmbed()
					.setTitle('Profile picture removed')
					.setDescription('The bot has reverted to its default profile picture in this server.')
					.setColor('Green'),
			],
		});
		Logging.quickInfo(interaction, `Custom bot profile picture removed by ${userMention(interaction.user.id)}.`);
		return;
	}

	if (!image.contentType?.startsWith('image/')) {
		await reportErrorToUser(interaction, 'The provided file must be an image.', true);
		return;
	}
	await guild.members.editMe({
		avatar: image.url,
		reason: `Bot profile picture updated by ${interaction.user.username} (${interaction.user.id})`,
	});
	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Profile picture updated')
				.setDescription("The bot's profile picture has been successfully updated for this server.")
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, `Bot profile picture updated by ${userMention(interaction.user.id)}.`);
};
