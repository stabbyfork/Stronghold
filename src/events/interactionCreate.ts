import { Events, InteractionReplyOptions, MessageFlags } from 'discord.js';
import { CommandConstruct, createEvent, ErrorReplies } from '../types.js';
import { commands } from '../commands.js';
import {
	constructError,
	getSubcommandExec,
	reportErrorToUser,
} from '../utils.js';

export default createEvent({
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction) {
		if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
			const cmd: CommandConstruct | undefined =
				commands?.[interaction.commandName as keyof typeof commands];
			if (!cmd) {
				console.error(
					`Command \`${interaction.commandName}\` not found`,
				);
				if (interaction.isChatInputCommand()) {
					reportErrorToUser(
						interaction,
						constructError([
							ErrorReplies.CommandNotFound,
							ErrorReplies.OutdatedCommand,
						]),
					);
				}
				return;
			}
			try {
				if (interaction.isAutocomplete()) {
					// Should exist, autocompletion
					await (cmd as CommandConstruct<true>)
						.autocomplete?.(interaction)
						.catch(console.error);
				} else {
					// Slash command
					const [cmdExec, _, hasSubcommands] =
						getSubcommandExec(interaction);
					if (hasSubcommands) {
						// Also run the main command function, even if there are subcommands
						await cmd.execute?.(interaction).catch(console.error);
					}
					await cmdExec(interaction).catch(console.error);
				}
			} catch (err) {
				console.error(
					`Error while executing command \`${interaction.commandName}\`: ${err}`,
				);
				if (
					interaction.isChatInputCommand() &&
					(typeof err === 'string' || err instanceof Error)
				) {
					const toReply: InteractionReplyOptions = {
						content: constructError(
							[
								ErrorReplies.UnknownError,
								ErrorReplies.PrefixWithError,
								ErrorReplies.ReportToOwner,
							],
							err,
						),
						flags: MessageFlags.Ephemeral,
					};
					reportErrorToUser(interaction, toReply);
				}
			}
		}
	},
});
