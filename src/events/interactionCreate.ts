import { Events, InteractionReplyOptions, MessageFlags } from 'discord.js';
import { CommandConstruct, createEvent } from '../types';
import { commands } from '../commands';
import { appOwnerId } from '../config.json';

export default createEvent({
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;
		const cmd: CommandConstruct | undefined =
			commands[interaction.commandName as keyof typeof commands];
		if (!cmd) {
			console.error(`Command \`${interaction.commandName}\` not found`);
			return;
		}
		try {
			await cmd.execute(interaction);
		} catch (error) {
			console.error(
				`Error while executing command \`${interaction.commandName}\`: ${error}`,
			);
			const toReply: InteractionReplyOptions = {
				content: `An unexpected error has occurred. Please report this to the bot owner: <@${appOwnerId}>.`,
				flags: MessageFlags.Ephemeral,
			};
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(toReply);
			} else {
				await interaction.reply(toReply);
			}
		}
	},
});
