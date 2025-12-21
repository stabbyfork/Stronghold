import { ChatInputCommandInteraction, GuildMember, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { client } from '../../client.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { createSessionModal } from './start.js';
import { Logging } from '../../utils/loggingUtils.js';

const enum CustomIds {
	DetailsModal = 'session-edit_default-modal',
	SessionTitle = 'session-edit_default-title',
	SessionMessage = 'session-edit_default-message',
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.session.edit_default) => {
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
	const messageLink = getOption(interaction, args, 'message_link');
	let messageData: [guildId: string, channelId: string, messageId: string] | undefined;
	let imageUrls: string[] = [];
	if (messageLink) {
		const match = messageLink.match(/(\d+)\/(\d+)\/(\d+)/);
		if (!match) {
			await reportErrorToUser(interaction, 'You must provide a valid message link.', true);
			return;
		}
		const [_, guildId, channelId, messageId] = match;
		const channel = await (client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId))).channels.fetch(
			channelId,
		);
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
		messageData = [guildId, channelId, messageId];
	}

	await interaction.showModal(
		createSessionModal(CustomIds.DetailsModal, CustomIds.SessionTitle, CustomIds.SessionMessage),
	);
	let submitted: ModalSubmitInteraction | undefined;
	try {
		submitted = await interaction.awaitModalSubmit({
			time: 60 * 1000,
			filter: (i) => i.customId === CustomIds.DetailsModal,
		});
		await submitted.deferUpdate();
	} catch {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionTimedOut]), true);
		return;
	}

	const title = submitted.fields.getTextInputValue(CustomIds.SessionTitle);
	const message = submitted.fields.getTextInputValue(CustomIds.SessionMessage);

	const channel = getOption(interaction, args, 'channel');
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
	await Data.mainDb.transaction(async (transaction) => {
		const [session, built] = await Data.models.GuildSession.findCreateFind({
			where: { guildId: guild.id },
			defaults: {
				guildId: guild.id,
				channelId: channel.id,
				active: false,
			},
			transaction,
		});
		if (!built) {
			await session.update(
				{
					channelId: channel.id,
				},
				{ transaction },
			);
		}

		await session.setDefaultOptions(null, { transaction, destroyPrevious: true });
		const sessionOpts = await session.createDefaultOptions(
			{ title, message },
			{ transaction, destroyPrevious: true },
		);
		if (messageData) {
			await sessionOpts.createImagesLink(
				{
					guildId: messageData[0],
					channelId: messageData[1],
					messageId: messageData[2],
				},
				{
					transaction,
					destroyPrevious: true,
				},
			);
		}
	});

	await interaction.followUp({
		embeds: [
			defaultEmbed()
				.setTitle('Session defaults edited')
				.setColor('Green')
				.setDescription(
					`Edited session defaults successfully. Use \`/session quickstart\` to start a session using the defaults.`,
				),
		],
		flags: MessageFlags.Ephemeral,
	});
	Logging.quickInfo(interaction, 'Edited session defaults.');
};
