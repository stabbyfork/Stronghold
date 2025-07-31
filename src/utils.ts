import {
	APIApplicationCommandSubcommandGroupOption,
	ApplicationCommandOptionType,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ComponentType,
	EmbedBuilder,
	Interaction,
	InteractionCallbackResponse,
	InteractionReplyOptions,
	MessageCollectorOptions,
	MessageComponentType,
	MessagePayload,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
} from 'discord.js';
import {
	CommandExecute,
	ErrorReplies,
	RecursiveFlatKeys,
	RecursiveFlatVals,
	SubcommandMap,
	SubcommandStructure,
} from './types.js';
import { commands, subcommands } from './commands.js';
import parse from 'parse-duration';
import { Config } from './config.js';

//#region Discord

/**
 * Creates a default embed for Discord messages.
 *
 * This function returns an instance of `EmbedBuilder` with a default footer
 * and timestamp. The footer indicates the embed was created by a bot and
 * provides the developer's user ID.
 *
 * @returns An instance of `EmbedBuilder` with a default footer and timestamp.
 */
export function defaultEmbed() {
	return new EmbedBuilder()
		.setFooter({
			text: `Created by a bot, developed by @${Config.get('appOwnerUsername')}.`,
		})
		.setTimestamp();
}

export function isSameUser(inter1: Interaction, inter2: Interaction) {
	return inter1.user.id === inter2.user.id;
}

/**
 * Waits for a message component to be triggered.
 *
 * @param response The callback response of the interaction.
 * @param filter The filter to use for the message component event.
 * @param timeoutS The timeout in seconds.
 *
 * @returns The message component, or `undefined` if the timeout was reached.
 */
export async function waitForMessageComp(
	response: InteractionCallbackResponse,
	filter: (inter: Interaction) => boolean,
	timeoutS: number,
) {
	try {
		return await response?.resource?.message?.awaitMessageComponent({
			filter: filter,
			time: timeoutS * 1000,
		});
	} catch (e) {
		console.log('Error while waiting for interaction: ', e);
		return;
	}
}

/**
 * Creates a message component collector and waits for components to be triggered.
 *
 * @param response The callback response of the interaction.
 * @param compType The type of the message component to listen for.
 * @param timeoutS The timeout in seconds.
 * @param callback The callback to call when a component is triggered.
 *
 * @returns Nothing; the collector is created and the callback is called when a
 * component is triggered.
 */
export async function messageCompCollector(
	response: InteractionCallbackResponse,
	timeoutS: number,
	callback: (i: ButtonInteraction) => Promise<void>,
	compType?: MessageComponentType,
) {
	const collector = response?.resource?.message?.createMessageComponentCollector({
		componentType: compType,
		time: timeoutS * 1000,
	});

	if (!collector) {
		Debug.error('Failed to create collector');
		return;
	}

	collector.on('collect', callback);
}

//#endregion

//#region Generics

/**
 * Returns the number of own enumerable string-keyed properties of an object.
 *
 * This is the same as {@link Object.keys | `Object.keys()`} but as a function.
 *
 * @param t The object to get the length from.
 * @returns The number of own enumerable string-keyed properties of the object.
 */
export function length(t: object) {
	return Object.keys(t).length;
}

/**
 * Recursively flattens the keys of an object into a new object.
 *
 * This function takes an object with potentially nested objects and
 * flattens its keys into a single object. Each key in the resulting
 * object corresponds to a key from the original object.
 *
 * If a value is an object, the function recursively processes its
 * properties, otherwise, it adds the key to the output object.
 *
 * @param obj The object to flatten the keys from.
 * @returns A new object with flattened keys.
 */
export function flattenKeys<T extends Record<any, any>, R extends { [V in RecursiveFlatKeys<T>]: V }>(obj: T): R {
	const out: R = {} as R;
	for (const [key, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			Object.assign(out, flattenKeys(val));
		} else {
			(out as any)[key] = key;
		}
	}
	return out;
}

/**
 * Recursively flattens the values of an object into a new object.
 *
 * This function takes an object with potentially nested objects and
 * flattens its values into a single object. Each value in the
 * resulting object corresponds to a value from the original object.
 *
 * If a value is an object, the function recursively processes its
 * properties, otherwise, it adds the value to the output object.
 *
 * @param obj The object to flatten.
 * @returns A new object with flattened values.
 */
export function flattenVals<T extends Record<any, any>, R extends { [V in RecursiveFlatVals<T>]: V }>(obj: T): R {
	const out: R = {} as R;
	for (const [key, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			Object.assign(out, flattenVals(val));
		} else {
			(out as any)[val] = val;
		}
	}
	return out;
}

export function objKeysEqual<T extends object>(a: object, b: T) {
	for (const key of Object.keys(a)) {
		if (!(key in b)) return false;
	}
	return true;
}

/**
 * Converts a duration string to a duration in seconds.
 *
 * The string should be in the format as specified by the `parse-duration` package.
 * If the string is invalid, the function returns `null`.
 *
 * @param str The duration string to parse.
 * @returns The duration in seconds, or `null` if the string is invalid.
 */
export function strToDuration(str: string) {
	const duration = parse(str);
	return duration ? duration / 1000 : null;
}

//#endregion

//#region Subcommands

/**
 * Recursively builds a {@link SubcommandMap} from a given {@link SlashCommandBuilder}.
 *
 * This function takes the JSON representation of a slash command and recursively
 * builds a map of subcommand names.
 *
 * Top-level subcommands are added to the map with their name as the key and value.
 * Subcommand groups are added to the map with their name as the key and the value
 * being another map of subcommands.
 *
 * @param command The slash command to build the map from.
 * @returns A map of subcommand names.
 * @example
 * const map = getSubcommands(command);
 * console.log(map); // { sub1: 'sub1', sub2: 'sub2', sub3: 'sub3', group: { sub1: 'group sub1', sub2: 'group sub2', sub3: 'group sub3' } }
 */
export function getSubcommands(command: SlashCommandBuilder, split: string = ' '): SubcommandMap | string {
	const json = command.toJSON() as RESTPostAPIApplicationCommandsJSONBody;

	const map: SubcommandMap = {};

	for (const option of json.options ?? []) {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			// Top level subcommand
			map[option.name] = command.name.concat(split, option.name);
		} else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
			// Subcommand group
			const group: SubcommandMap = {};
			for (const sub of (option as APIApplicationCommandSubcommandGroupOption).options ?? []) {
				if (sub.type === ApplicationCommandOptionType.Subcommand) {
					group[sub.name] = [command.name, option.name, sub.name].join(split);
				}
			}
			map[option.name] = group;
		}
	}

	return length(map) === 0 ? command.name : map;
}
/**
 * @ignore @internal @hidden
 */
function _notFoundFunc(input?: ChatInputCommandInteraction) {
	Debug.error(
		`Command /${[input?.commandName, input?.options.getSubcommandGroup(), input?.options.getSubcommand()].join(' ')} not found during subcommand search`,
	);
	return async (replyInteraction: ChatInputCommandInteraction) => {
		reportErrorToUser(
			replyInteraction,
			constructError([ErrorReplies.CommandNotFound, ErrorReplies.OutdatedCommand]),
		);
	};
}

/**
 * Finds the execute function for the given subcommand interaction.
 *
 * Given a ChatInputCommandInteraction, this function returns a tuple containing
 * the execute function for the subcommand, a boolean indicating whether the
 * subcommand was found, and a boolean indicating whether the subcommand has
 * subcommands. Errors are handled. If a command isn't found, a function is returned
 * which sends an error message to the user and logs the error.
 *
 * @param interaction The interaction to find the execute function for.
 * @returns A tuple containing the execute function, a boolean indicating
 * whether the subcommand was found, and a boolean indicating whether the
 * subcommand has subcommands.
 */
export function getSubcommandExec(
	interaction: ChatInputCommandInteraction,
): [CommandExecute, found: boolean, hasSubcommands: boolean] {
	if (!(interaction.commandName in subcommands)) {
		const exec = commands?.[interaction.commandName as keyof typeof commands]?.execute;
		if (exec) {
			return [exec, true, false];
		} else {
			return [_notFoundFunc(interaction), false, false];
		}
	}
	const command = interaction.options.getSubcommand();
	const group = interaction.options.getSubcommandGroup();
	if (group) {
		if (!(interaction.commandName in subcommands)) return [_notFoundFunc(interaction), false, false];
		const cmds = subcommands[interaction.commandName as keyof SubcommandStructure];
		const groupSubcmds = cmds[group as keyof typeof cmds];
		if (typeof groupSubcmds !== 'object' || groupSubcmds === null)
			return [_notFoundFunc(interaction), false, false];
		const subcmd = groupSubcmds[command as keyof typeof groupSubcmds] as CommandExecute | undefined;
		if (typeof subcmd !== 'function') return [_notFoundFunc(interaction), false, false];
		return [subcmd, true, true];
	} else {
		const cmds = subcommands[interaction.commandName as keyof SubcommandStructure];
		const subcmd = cmds[command as keyof typeof cmds] as CommandExecute | undefined;
		if (typeof subcmd !== 'function') return [_notFoundFunc(interaction), false, false];
		return [subcmd, true, true];
	}
}

/*export function getSubcommandsFlatten(
	command: SlashCommandBuilder,
	split: string = ' ',
): string[] {
	const out: string[] = [];
	for (const [key, value] of Object.entries(getSubcommands(command, split))) {
		if (typeof value === 'string') {
			out.push(value);
		} else {
			out.push(...getSubcommandsFlatten(subcommands[key], split));
		}
	}
	return out;
}*/

/*function buildCommandFromStructure(
	structure: SubcommandStructure,
): SlashCommandBuilder {
	const builder = new SlashCommandBuilder()
		.setName('example')
		.setDescription('Generated command');

	for (const [topLevel, child] of Object.entries(structure)) {
		if (Object.keys(child).length === 0) {
			builder.addSubcommand((sub) =>
				sub.setName(topLevel).setDescription(`${topLevel} command`),
			);
		} else {
			builder.addSubcommandGroup((group) => {
				group.setName(topLevel).setDescription(`${topLevel} group`);
				for (const [sub, subChild] of Object.entries(child)) {
					if (Object.keys(subChild).length === 0) {
						group.addSubcommand((subCmd) =>
							subCmd
								.setName(sub)
								.setDescription(`${sub} subcommand`),
						);
					} else {
						for (const [deepSub, _] of Object.entries(subChild)) {
							builder.addSubcommandGroup((group2) => {
								group2
									.setName(`${topLevel}-${sub}`)
									.setDescription(`Group for ${sub}`);
								group2.addSubcommand((subCmd) =>
									subCmd
										.setName(deepSub)
										.setDescription(
											`${deepSub} subcommand`,
										),
								);
								return group2;
							});
						}
					}
				}
				return group;
			});
		}
	}

	return builder;
}*/

//#endregion

//#region Errors

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
	interaction: ChatInputCommandInteraction,
	error: string | InteractionReplyOptions | MessagePayload,
) {
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(error);
	} else {
		await interaction.reply(error);
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
