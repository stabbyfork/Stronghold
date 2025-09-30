import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { UsageScope } from '../utils/usageLimitsUtils.js';

export default createCommand<{}, 'session'>({
	data: new SlashCommandBuilder()
		.setName('session')
		.setDescription('Session commands')
		.addSubcommand((cmd) => cmd.setName('status').setDescription('See the status of the ongoing session'))
		.addSubcommand((cmd) =>
			cmd
				.setName('start')
				.setDescription('Start a session')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Channel to send message to')
						.setRequired(true)
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
				)
				.addAttachmentOption((option) =>
					option.setName('image').setDescription('Image to display').setRequired(false),
				)
				.addStringOption((option) =>
					option
						.setName('message_link')
						.setDescription('Link to a message with images to display')
						.setRequired(false),
				),
		)
		.addSubcommand((cmd) => cmd.setName('quickstart').setDescription('Start a session with the default settings'))
		.addSubcommand((cmd) => cmd.setName('stop').setDescription('End the current session'))
		.addSubcommand((cmd) =>
			cmd
				.setName('edit')
				.setDescription('Edit the current session')
				.addBooleanOption((option) =>
					option
						.setName('edit_message')
						.setDescription('Edit the session title and message (defaults to true)')
						.setRequired(false),
				)
				.addAttachmentOption((option) =>
					option.setName('image').setDescription('Image to display').setRequired(false),
				)
				.addStringOption((option) =>
					option
						.setName('message_link')
						.setDescription('Link to a message with images to display')
						.setRequired(false),
				),
		)
		.addSubcommand((cmd) =>
			cmd
				.setName('edit_default')
				.setDescription('Edit the default session options')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Channel to send message to')
						.setRequired(true)
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
				)
				.addStringOption((option) =>
					option
						.setName('message_link')
						.setDescription('Link to a message with images to display')
						.setRequired(false),
				),
		)
		.addSubcommand((cmd) =>
			cmd.setName('participants').setDescription('List the participants of the current session'),
		),
	description: {
		start: 'You can either attach an image to the image option, or provide a message link to get images from. A message link can be obtained by right-clicking on a message and clicking "Copy Message Link".\nClicking "Join" just marks the user as in the session.',
	},
	limits: {
		start: {
			intervalMs: 0,
			usesPerInterval: 1,
			useCooldown: 30 * 1000,
			scope: UsageScope.GuildAll,
		},
		stop: {
			intervalMs: 0,
			usesPerInterval: 1,
			useCooldown: 30 * 1000,
			scope: UsageScope.GuildAll,
		},
		status: {
			intervalMs: 0,
			usesPerInterval: 1,
			useCooldown: 5 * 1000,
			scope: UsageScope.GuildMember,
		},
		edit: {
			intervalMs: 60 * 1000,
			usesPerInterval: 3,
			useCooldown: 5 * 1000,
			scope: UsageScope.GuildAll,
		},
		quickstart: {
			intervalMs: 40 * 1000,
			usesPerInterval: 2,
			useCooldown: 15 * 1000,
			scope: UsageScope.GuildAll,
		},
		participants: {
			intervalMs: 25 * 1000,
			usesPerInterval: 3,
			useCooldown: 5 * 1000,
			scope: UsageScope.GuildAll,
		},
	},
});
