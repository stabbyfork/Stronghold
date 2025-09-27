//#region Errors

import { EmbedBuilder, InteractionReplyOptions, MessageFlags, MessagePayload, RepliableInteraction } from 'discord.js';
import { ErrorReplies } from '../types/errors.js';

/**
 * Constructs an error message string by replacing placeholders with the provided error details.
 *
 * This function iterates over a list of predefined error messages, replacing
 * the `!{ERROR}` placeholder in each message with a string representation of
 * the provided error, if available. If no error is provided, it defaults to
 * 'Unspecified'. The resulting messages are concatenated into a single
 * newline-separated string.
 *
 * @param messages An array of error messages to be processed.
 * @param error An optional error object or string to insert into the messages.
 * @returns A single string containing the processed error messages.
 *
 * For reporting errors, see {@link reportErrorToUser}.
 * @see {@link ErrorReplies}
 */
export function constructError(messages: (typeof ErrorReplies)[keyof typeof ErrorReplies][], error?: Error | string) {
	return messages.map((message) => message.replace(/!{ERROR}/g, error?.toString() ?? 'Unspecified')).join('\n');
}

/**
 * Sends an error message to the user through a Discord interaction.
 *
 * This function determines whether the interaction has already been replied to
 * or deferred. If it has, the error message is dispatched as a follow-up message.
 * Otherwise, it sends the error message directly as a reply to the interaction.
 *
 * Example:
 * ```typescript
 * const errorMsg = constructError([
 *   ErrorReplies.UnknownError,
 *   ErrorReplies.PrefixWithError,
 *   ErrorReplies.ReportToOwner,
 * ]);
 * reportErrorToUser(interaction, errorMsg);
 * ```
 *
 * @param interaction The interaction object representing the user's command.
 * @param error The error message to be sent to the user.
 * @see {@link constructError} for constructing error messages.
 */
export async function reportErrorToUser(
	interaction: RepliableInteraction,
	error: string | InteractionReplyOptions | MessagePayload,
	ephemeral = true,
) {
	const toReply = (
		typeof error === 'string'
			? {
					embeds: [new EmbedBuilder().setTitle('Error').setDescription(error).setColor('Red').setTimestamp()],
					flags: ephemeral ? MessageFlags.Ephemeral : undefined,
				}
			: error
	) satisfies InteractionReplyOptions | MessagePayload;
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(toReply);
	} else {
		await interaction.reply(toReply);
	}
}

export namespace Debug {
	/**
	 * Prints an error message to the console.
	 *
	 * This function is a simple wrapper around `console.error` that takes multiple
	 * arguments and joins them with a space character before creating an `Error`
	 * object that is passed to `console.error`.
	 *
	 * @param args The arguments to be joined and passed to `console.error`.
	 */
	export function error(...args: any[]) {
		console.error(new Error(args.join(' ')));
	}
}

//#endregion
