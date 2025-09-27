import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';

export default createCommand<{}, 'activity'>({
	data: new SlashCommandBuilder()
		.setName('activity')
		.setDescription('Commands relating to activity and activity checks')
		.addSubcommandGroup((group) =>
			group
				.setName('checks')
				.setDescription('Commands to work with activity checks')
				.addSubcommand((cmd) =>
					cmd
						.setName('create')
						.setDescription('Create an optionally repeating activity check, sent to a channel')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to send the activity check to')
								.setRequired(true)
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
						)
						.addStringOption((option) =>
							option
								.setName('sequence')
								.setDescription('Sequence of events to execute. Leave empty for default'),
						)
						.addStringOption((option) =>
							option
								.setName('interval')
								.setDescription(
									'Interval between activity checks in the format: `?d, ?h`. Min 1h, max 21d. Omitting stops repeating',
								),
						)
						.addIntegerOption((option) =>
							option
								.setName('max-strikes')
								.setDescription(
									`Inactivity strike threshold, after which an inactive user may be kicked. Defaults to 3`,
								),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('execute')
						.setDescription('Execute all inactive p- no, run a sequence of events ')
						.addStringOption((option) =>
							option.setName('override-sequence').setDescription('Override the set sequence of events'),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('cancel')
						.setDescription('Cancel (DELETE) the ongoing activity check. Use to change options'),
				)
				.addSubcommand((cmd) => cmd.setName('pause').setDescription('Pause the ongoing activity check'))
				.addSubcommand((cmd) => cmd.setName('resume').setDescription('Resume a paused activity check'))
				.addSubcommand((cmd) =>
					cmd.setName('info').setDescription('See info about how to format event sequences'),
				),
		),
	limits: {
		checks: {
			execute: { usesPerInterval: 3, useCooldown: 5 * 1000, intervalMs: 60 * 1000 },
		},
	},
});
