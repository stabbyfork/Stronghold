import {
	channelMention,
	ChatInputCommandInteraction,
	ContainerBuilder,
	ContainerComponent,
	GuildMember,
	MessageFlags,
	ModalSubmitInteraction,
	TextDisplayComponent,
	TextInputComponent,
} from 'discord.js';
import { client } from '../../client.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { createSessionMessage, createSessionModal } from './start.js';

const enum CustomIds {
	DetailsModal = 'session-edit-modal',
	SessionTitle = 'session-edit-title',
	SessionMessage = 'session-edit-message',
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.edit) => {
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
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoExistingSession]), true);
		return;
	}
	let imageUrls: string[] = [];
	const editAttachments = getOption(interaction, args, 'edit_attachments') ?? true;
	const [image, messageLink] = [getOption(interaction, args, 'image'), getOption(interaction, args, 'message_link')];
	if (editAttachments) {
		if (image && messageLink) {
			await reportErrorToUser(interaction, 'You cannot provide both an image and a link to a message.', true);
			return;
		}

		if (image) {
			if (image.contentType?.includes('image')) {
				imageUrls = [image.url];
			} else {
				await reportErrorToUser(interaction, 'You must provide an image attachment.', true);
				return;
			}
		} else if (messageLink) {
			const match = messageLink.match(/(\d+)\/(\d+)\/(\d+)/);
			if (!match) {
				await reportErrorToUser(interaction, 'You must provide a valid message link.', true);
				return;
			}
			const [_, guildId, channelId, messageId] = match;
			const sendGuild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
			const channel = sendGuild.channels.cache.get(channelId) ?? (await sendGuild.channels.fetch(channelId));
			if (!channel) {
				await reportErrorToUser(interaction, 'You must provide a valid message link.', true);
				return;
			}
			if (!channel.isTextBased()) {
				await reportErrorToUser(
					interaction,
					'You must provide a link to a message in a text-based channel.',
					true,
				);
				return;
			}
			const message = await channel.messages.fetch(messageId);
			if (message.attachments.size === 0) {
				await reportErrorToUser(
					interaction,
					'You must provide a link to a message with at least one image.',
					true,
				);
				return;
			}
			if (message.attachments.size > 4) {
				await reportErrorToUser(
					interaction,
					'You must provide a link to a message with at most 4 images.',
					true,
				);
				return;
			}
			message.attachments.map((a) => imageUrls.push(a.url));
		}
	}

	const editMessage = getOption(interaction, args, 'edit_message') ?? true;
	let toSend: ContainerBuilder | undefined;
	if (editMessage) {
		await interaction.showModal(
			createSessionModal(CustomIds.DetailsModal, CustomIds.SessionTitle, CustomIds.SessionMessage),
		);
		let submitted: ModalSubmitInteraction | undefined;
		try {
			submitted = await interaction.awaitModalSubmit({
				time: 15 * 60 * 1000,
				filter: (i) => i.customId === CustomIds.DetailsModal,
			});
			await submitted.deferUpdate();
		} catch {
			await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionTimedOut]), true);
			return;
		}
		const title = submitted.fields.getTextInputValue(CustomIds.SessionTitle);
		const message = submitted.fields.getTextInputValue(CustomIds.SessionMessage);
		toSend = createSessionMessage(title, message, imageUrls, interaction.user.id);
	}
	console.log(imageUrls);
	const channel = guild.channels.cache.get(session.channelId) ?? (await guild.channels.fetch(session.channelId));
	if (!channel) {
		await reportErrorToUser(interaction, 'Session channel no longer exists.', true);
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
	if (!session.sessionMessageId) {
		await reportErrorToUser(
			interaction,
			constructError(
				[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
				'Session message is not available.',
			),
			true,
		);
		return;
	}
	const sentMessage =
		channel.messages.cache.get(session.sessionMessageId) ??
		(await channel.messages.fetch(session.sessionMessageId));
	if (!editAttachments) {
		const attchs = sentMessage.attachments.map((a) => a.url);
		imageUrls = imageUrls.concat(attchs);
	}
	if (!editMessage) {
		const container = sentMessage.components[0] as ContainerComponent;
		const title = (container.components[0] as TextDisplayComponent).content;
		const message = (container.components[1] as TextDisplayComponent).content;
		toSend = createSessionMessage(title, message, imageUrls, interaction.user.id);
	}
	await sentMessage.edit({
		components: [toSend!],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { roles: [], users: [] },
	});
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Session edited')
				.setColor('Green')
				.setDescription(
					`Edited session and message in ${channelMention(session.channelId)} successfully (${sentMessage.url}).`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
};
