import { SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types.js';

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('activity')
		.setDescription('Commands relating to activity and activity checks')
		.addSubcommandGroup((group) =>
			group
				.setName('checks')
				.setDescription('Commands for activity checks')
				.addSubcommand((cmd) =>
					cmd
						.setName('create')
						.setDescription(
							'Create an optionally repeating activity check, sent to a channel',
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription(
									'The channel to send the activity check to',
								)
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setRequired(true)
								.setName('emoji')
								.setDescription(
									'The emoji (reaction) to use for the activity check',
								),
						)
						.addStringOption((option) =>
							option
								.setName('sequence')
								.setDescription('The sequence of events'),
						)
						.addIntegerOption((option) =>
							option
								.setName('interval')
								.setDescription(
									'The interval between activity checks in seconds, use an online converter for convenience',
								),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('execute')
						.setDescription(
							'Run the sequence of events for those who have NOT reacted to the activity check',
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('cancel')
						.setDescription('Cancel the ongoing activity check'),
				),
		),
});
