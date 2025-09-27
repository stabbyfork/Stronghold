import { channelMention, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { Data } from '../../data.js';
import { ErrorReplies, Errors } from '../../types/errors.js';
import { createSessionMessage } from './start.js';
import { client } from '../../client.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { reportErrorToUser, constructError } from '../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageSessions))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageSessions),
			true,
		);
		return;
	}
	const session = await Data.models.GuildSession.findOne({ where: { guildId: guild.id } });
	if (!session) {
		await reportErrorToUser(interaction, 'No session defaults have been set. Use `/session edit_defaults`.', true);
		return;
	}
	if (session.active) {
		await reportErrorToUser(
			interaction,
			'There is already an active session. Use `/session stop` to end the existing session.',
			true,
		);
		return;
	}
	const channel = guild.channels.cache.get(session.channelId) ?? (await guild.channels.fetch(session.channelId));
	if (!channel) {
		await reportErrorToUser(interaction, 'Session channel could not be found.', true);
		return;
	}
	if (!channel.isSendable()) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'Channel cannot be sent to'),
			true,
		);
		return;
	}
	const opts = await session.getDefaultOptions();
	if (!opts) {
		await reportErrorToUser(interaction, 'No session defaults have been set. Use `/session edit_defaults`.', true);
		return;
	}
	const title = opts.title;
	const message = opts.message;
	const messageLink = await opts.getImagesLink();
	const imageUrls: string[] = [];
	if (messageLink) {
		const message = await messageLink.getMessage();
		message.attachments.map((a) => imageUrls.push(a.url));
	}
	const toSend = createSessionMessage(title, message, imageUrls, interaction.user.id);
	const sentMessage = await channel.send({
		components: [toSend],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { roles: [], users: [] },
	});
	await session.update({ startedAt: new Date(), sessionMessageId: sentMessage.id, active: true });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Started session')
				.setColor('Green')
				.setDescription(
					`Started session and sent message to ${channelMention(channel.id)} successfully (${sentMessage.url}).`,
				),
		],
	});
};
