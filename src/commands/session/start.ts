import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	channelMention,
	ChatInputCommandInteraction,
	ContainerBuilder,
	GuildMember,
	MediaGalleryItemBuilder,
	Message,
	MessageFlags,
	ModalActionRowComponentBuilder,
	ModalBuilder,
	ModalSubmitInteraction,
	TextInputBuilder,
	TextInputStyle,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { client } from '../../client.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies, Errors } from '../../types/errors.js';
import { GlobalCustomIds } from '../../types/eventTypes.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { GuildFlag } from '../../utils/guildFlagsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { GuildAssociations } from '../../models/guild.js';

export function createSessionMessage(title: string, message: string, imageUrls: string[], userId: string) {
	const msg = new ContainerBuilder().setAccentColor([255, 255, 255]).addTextDisplayComponents(
		(text) => text.setContent(`## ${title}`),
		(text) => text.setContent(message),
	);
	if (imageUrls.length > 0) {
		msg.addMediaGalleryComponents((media) =>
			media.addItems(imageUrls.map((url) => new MediaGalleryItemBuilder().setURL(url))),
		);
	}
	msg.addTextDisplayComponents((text) =>
		text.setContent(
			`-# Started by ${userMention(userId)} at ${time(new Date(), TimestampStyles.ShortTime)} ||Contains user-generated content. The bot is not responsible for this content.||`,
		),
	).addActionRowComponents((row) =>
		row.addComponents(
			new ButtonBuilder()
				.setLabel('Join')
				.setCustomId(GlobalCustomIds.InSessionJoin)
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setLabel('Leave')
				.setCustomId(GlobalCustomIds.InSessionLeave)
				.setStyle(ButtonStyle.Danger),
		),
	);
	return msg;
}

export function createSessionModal(customId: string, titleId: string, messageId: string) {
	return new ModalBuilder()
		.setTitle('Session details')
		.setCustomId(customId)
		.addComponents(
			new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
				new TextInputBuilder()
					.setCustomId(titleId)
					.setLabel('Title')
					.setStyle(TextInputStyle.Short)
					.setMaxLength(64)
					.setRequired(true),
			),
			new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
				new TextInputBuilder()
					.setCustomId(messageId)
					.setLabel('Message')
					.setStyle(TextInputStyle.Paragraph)
					.setMaxLength(256)
					.setPlaceholder('Host: John Discord\nGame: ...')
					.setRequired(true),
			),
		);
}

const enum CustomIds {
	DetailsModal = 'session-start-modal',
	SessionTitle = 'session-title',
	SessionMessage = 'session-message',
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.start) => {
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
	const session = await Data.models.GuildSession.findOne({
		where: { guildId: guild.id },
	});
	if (session?.active) {
		await reportErrorToUser(
			interaction,
			'There is already an active session. Use `/session stop` to end the existing session.',
			true,
		);
		return;
	}
	const [image, messageLink] = [getOption(interaction, args, 'image'), getOption(interaction, args, 'message_link')];
	if (image && messageLink) {
		await reportErrorToUser(interaction, 'You cannot provide both an image and a link to a message.', true);
		return;
	}
	let imageUrls: string[] = [];
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
		const channel = await client.guilds.fetch(guildId).then((g) => g?.channels.fetch(channelId));
		if (!channel) {
			await reportErrorToUser(interaction, 'You must provide a valid message link.', true);
			return;
		}
		if (!channel.isTextBased()) {
			await reportErrorToUser(interaction, 'You must provide a link to a message in a text-based channel.', true);
			return;
		}
		const message = await channel.messages.fetch(messageId);
		if (message.attachments.size === 0) {
			await reportErrorToUser(interaction, 'You must provide a link to a message with at least one image.', true);
			return;
		}
		if (message.attachments.size > 4) {
			await reportErrorToUser(interaction, 'You must provide a link to a message with at most 4 images.', true);
			return;
		}
		message.attachments.map((a) => imageUrls.push(a.url));
	}

	await interaction.showModal(
		createSessionModal(CustomIds.DetailsModal, CustomIds.SessionTitle, CustomIds.SessionMessage),
	);
	let submitted: ModalSubmitInteraction | undefined;
	try {
		submitted = await interaction.awaitModalSubmit({
			time: 15 * 60 * 1000,
			filter: (i) => i.customId === CustomIds.DetailsModal,
		});
	} catch {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionTimedOut]), true);
		return;
	}
	await submitted.deferUpdate();

	const title = submitted.fields.getTextInputValue(CustomIds.SessionTitle);
	const message = submitted.fields.getTextInputValue(CustomIds.SessionMessage);

	const toSend = createSessionMessage(title, message, imageUrls, interaction.user.id);
	const channel = getOption(interaction, args, 'channel');
	let sentMessage: Message | undefined;
	await Data.mainDb.transaction(async (transaction) => {
		if (channel.isSendable()) {
			sentMessage = await channel.send({
				components: [toSend],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { roles: [], users: [] },
			});
			await interaction.followUp({
				embeds: [
					defaultEmbed()
						.setTitle('Started session')
						.setColor('Green')
						.setDescription(
							`Started session and sent message to ${channelMention(channel.id)} successfully (${sentMessage.url}).`,
						),
				],
				flags: MessageFlags.Ephemeral,
			});
		} else {
			throw new Error('Channel must be a regular text channel.');
		}
		const [data, built] = await Data.models.GuildSession.findOrBuild({
			where: { guildId: guild.id },
			defaults: {
				guildId: guild.id,
				channelId: channel.id,
				startedAt: new Date(),
				sessionMessageId: sentMessage.id,
				active: true,
				title,
				message,
			},
			transaction,
		});
		if (!built) {
			data.set({
				channelId: channel.id,
				startedAt: new Date(),
				sessionMessageId: sentMessage.id,
				active: true,
				title,
				message,
			});
		}
		await data.save({ transaction });
	});
	await Logging.log({
		data: interaction,
		logType: Logging.Type.Info,
		extents: [GuildFlag.LogInfo],
		formatData: `Session started by ${userMention(interaction.user.id)}`,
	});
};
