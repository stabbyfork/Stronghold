import {
	ActionRowBuilder,
	ComponentType,
	MessageCreateOptions,
	MessageFlags,
	MessagePayload,
	ModalActionRowComponentBuilder,
	ModalBuilder,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
	userMention,
} from 'discord.js';
import { createCommand } from '../../types/commandTypes.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { commandOptions } from '../../cmdOptions.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { Config } from '../../config.js';
import { client } from '../../client.js';
import { UsageScope } from '../../utils/usageLimitsUtils.js';

const enum FeedbackType {
	Bug,
	Feature,
	Misc,
	Report,
}

const enum CustomId {
	BugDescription = 'bug-description',
	FeatureDescription = 'feature-description',
	OtherText = 'other-text',
	Bug = 'bug',
	Feature = 'feature',
	Other = 'other',
	Report = 'report',
	ReportDescription = 'report-description',
}

export default createCommand<typeof commandOptions.feedback>({
	data: new SlashCommandBuilder()
		.setName('feedback')
		.setDescription('Send feedback to the bot developer')
		.addIntegerOption((option) =>
			option
				.setName('type')
				.setDescription('The type of feedback to send')
				.setRequired(true)
				.addChoices(
					{ name: 'Bug', value: FeedbackType.Bug },
					{ name: 'Feature', value: FeedbackType.Feature },
					{ name: 'Miscellaneous', value: FeedbackType.Misc },
					{ name: 'Report a server', value: FeedbackType.Report },
				),
		),
	execute: async (interaction, args: typeof commandOptions.feedback) => {
		const feedbackType = getOption(interaction, args, 'type');
		switch (feedbackType) {
			case FeedbackType.Bug:
				await interaction.showModal(
					new ModalBuilder()
						.setCustomId(CustomId.Bug)
						.setTitle('Bug report')
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(CustomId.BugDescription)
									.setLabel('Describe the bug: errors, options, context')
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(3600)
									.setPlaceholder(
										'You can also paste the error and command.\n\nExample:\nError message:\nArguments:\nContext:\n...',
									)
									.setRequired(true),
							),
						),
				);
				break;
			case FeedbackType.Feature:
				await interaction.showModal(
					new ModalBuilder()
						.setTitle('Feature request')
						.setCustomId(CustomId.Feature)
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(CustomId.FeatureDescription)
									.setLabel('Why and what would it do?')
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(3600)
									.setPlaceholder(
										'<Insert ridiculous feature>\nYou should add this because I said so...\nIt will achieve nothing...',
									)
									.setRequired(true),
							),
						),
				);
				break;
			case FeedbackType.Misc:
				await interaction.showModal(
					new ModalBuilder()
						.setTitle('Miscellaneous message')
						.setCustomId(CustomId.Other)
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(CustomId.OtherText)
									.setLabel('Your message')
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(3600)
									.setPlaceholder('plss give me 5000 bobuks')
									.setRequired(true),
							),
						),
				);
				break;
			case FeedbackType.Report:
				await interaction.showModal(
					new ModalBuilder()
						.setTitle('Report a server')
						.setCustomId(CustomId.Report)
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId(CustomId.ReportDescription)
									.setLabel('Description of the violation')
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(3600)
									.setPlaceholder(
										'The server is... and has an inappropriate tag... (please identify the server)',
									),
							),
						),
				);
				break;
			default:
				throw new Error('Invalid feedback type, got: ' + feedbackType);
		}
		try {
			const submitted = await interaction.awaitModalSubmit({
				time: 15 * 60 * 1000,
				filter: (i) =>
					i.customId === CustomId.Bug ||
					i.customId === CustomId.Feature ||
					i.customId === CustomId.Other ||
					i.customId === CustomId.Report,
			});
			await submitted.deferUpdate();
			const ownerId = Config.get('appOwnerId');
			const developer = client.users.cache.get(ownerId) ?? (await client.users.fetch(ownerId));
			let toSend: MessageCreateOptions;
			switch (feedbackType) {
				case FeedbackType.Bug:
					toSend = {
						embeds: [
							defaultEmbed()
								.setTitle('Bug report')
								.setAuthor({
									name: interaction.user.username,
									iconURL: interaction.user.displayAvatarURL(),
								})
								.setDescription(
									`From ${userMention(interaction.user.id)}:\n${submitted.fields.getTextInputValue(CustomId.BugDescription)}`,
								)
								.setColor('Red'),
						],
					};
					break;
				case FeedbackType.Feature:
					toSend = {
						embeds: [
							defaultEmbed()
								.setTitle('Feature request')
								.setAuthor({
									name: interaction.user.username,
									iconURL: interaction.user.displayAvatarURL(),
								})
								.setDescription(
									`From ${userMention(interaction.user.id)}:\n${submitted.fields.getTextInputValue(CustomId.FeatureDescription)}`,
								)
								.setColor('Gold'),
						],
					};
					break;
				case FeedbackType.Misc:
					toSend = {
						embeds: [
							defaultEmbed()
								.setTitle('Miscellaneous feedback')
								.setAuthor({
									name: interaction.user.username,
									iconURL: interaction.user.displayAvatarURL(),
								})
								.setDescription(
									`From ${userMention(interaction.user.id)}:\n${submitted.fields.getTextInputValue(CustomId.OtherText)}`,
								)
								.setColor('Grey'),
						],
					};
					break;
				case FeedbackType.Report:
					toSend = {
						embeds: [
							defaultEmbed()
								.setTitle('Report a server')
								.setAuthor({
									name: interaction.user.username,
									iconURL: interaction.user.displayAvatarURL(),
								})
								.setDescription(
									`From ${userMention(interaction.user.id)}:\n${submitted.fields.getTextInputValue(CustomId.ReportDescription)}`,
								)
								.setColor('Red'),
						],
					};
				default:
					await reportErrorToUser(
						interaction,
						constructError(
							[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
							'Invalid feedback type, got: ' + feedbackType,
						),
						true,
					);
					return;
			}
			await developer.send(toSend);
		} catch {
			await reportErrorToUser(interaction, ErrorReplies.InteractionTimedOut, true);
			return;
		}
		await interaction.followUp({
			embeds: [
				defaultEmbed()
					.setTitle('Feedback sent')
					.setDescription('Your feedback has been sent to the bot developer. Thank you!')
					.setColor('Green'),
			],
			flags: MessageFlags.Ephemeral,
		});
	},
	limits: {
		usesPerInterval: 5,
		intervalMs: 3 * 60 * 1000,
		useCooldown: 15 * 1000,
		scope: UsageScope.GuildMember,
	},
});
