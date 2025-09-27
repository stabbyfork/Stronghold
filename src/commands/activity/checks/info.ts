import { ChatInputCommandInteraction } from 'discord.js';
import { ActivityCheckSequence, ActivityCheckEvent } from '../../../types/activityChecks.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const sep = ActivityCheckSequence.SEPARATOR;
	const example = [ActivityCheckEvent.MessageInactive, ActivityCheckEvent.DeleteCurrentMessage];
	interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Activity check runs')
				.setDescription(
					`When an activity check is run, it may run one or more of the following events:\n\n\
                    ${Object.values(ActivityCheckEvent)
						.filter((e) => typeof e === 'string')
						.map((e) => `\`${e}\` - \`${ActivityCheckEvent[e as keyof typeof ActivityCheckEvent]}\``)
						.join(
							'\n',
						)}\n\nEach event has a corresponding number that can be used to create a sequence of events run in order.\
                        \n\nThe sequence is a \`${ActivityCheckSequence.SEPARATOR}\` ${ActivityCheckSequence.SEPARATOR === ' ' ? '(space)' : ''} separated list of event numbers \
                        OR event names, for example: \`${example.join(sep)}\`,\
                        when using \`/activity checks execute\` or the activity check is run automatically, a DM is sent to those who are considered inactive,\
						and the previous activity check's message is deleted, but \`${example.map((e) => ActivityCheckEvent[e]).join(sep)}\` *also* works.\n\nOmmitting a sequence will result in the default, ${ActivityCheckSequence.DEFAULT.toString()}, \
						being run.`,
				)
				.addFields([
					{
						name: ActivityCheckEvent[ActivityCheckEvent.AddRoleToInactiveAndRemoveFromActive],
						value: `Add a custom \`Inactive\` role to inactive users and remove it from active users.`,
						inline: true,
					},
					{
						name: ActivityCheckEvent[ActivityCheckEvent.DeleteCurrentMessage],
						value: `Delete the current activity check's message. Best used with \`${ActivityCheckEvent[ActivityCheckEvent.SendNextMessage]}\`.`,
						inline: true,
					},
					{
						name: ActivityCheckEvent[ActivityCheckEvent.MessageInactive],
						value: `Send a DM to inactive users. Has a usage limit in \`/activity check execute\` to prevent spam.`,
						inline: true,
					},
					{
						name: ActivityCheckEvent[ActivityCheckEvent.KickInactiveOverStrikesLimit],
						value: `Kick all members who have exceeded the maximum amount of strikes, defined while creating an activity check.`,
						inline: true,
					},
					{
						name: ActivityCheckEvent[ActivityCheckEvent.PingInactive],
						value: `Ping the Inactive role in the activity check channel.`,
						inline: true,
					},
					{
						name: ActivityCheckEvent[ActivityCheckEvent.SendNextMessage],
						value: `Send the next activity check message. Required if you want the activity check to repeat automatically.`,
						inline: true,
					},
				]),
		],
	});
};
