import {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	ClientEvents,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { subcommands } from './commands.js';
import { constructError } from './utils.js';
import { Config } from './config.js';

//#region Commands

export function createCommand<T extends CommandData>({
	data,
	execute,
	autocomplete,
}: {
	data: CommandData;
	execute?: (interaction: ChatInputCommandInteraction) => Promise<void>;
	autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
}): CommandConstruct<true>;
export function createCommand<T extends CommandData>({
	data,
	execute,
}: {
	data: CommandData;
	execute?: (interaction: ChatInputCommandInteraction) => Promise<void>;
}): CommandConstruct<false>;
/**
 * Creates a new command construct
 *
 * @param data The data for the command
 * @param execute The execute function for the command
 * @param autocomplete The autocomplete function for the command. If not provided, then the command will not have autocomplete support.
 * @returns The command construct
 */
export function createCommand<Autocomplete extends boolean = false>({
	data,
	execute,
	autocomplete,
}: {
	data: CommandData;
	execute?: (interaction: ChatInputCommandInteraction) => Promise<void>;
	autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}): CommandConstruct<Autocomplete> {
	/*const subcommands =
		// Check if there are subcommands
		'addSubcommand' in data
			? getSubcommands(data as SlashCommandBuilder)
			: {};*/
	if (autocomplete === undefined) {
		return { data, execute } as any;
	} else {
		return { data, execute, autocomplete };
	}
}
type CommandData =
	| SlashCommandBuilder
	| SlashCommandOptionsOnlyBuilder
	| SlashCommandSubcommandsOnlyBuilder;
export type CommandExecute = (
	interaction: ChatInputCommandInteraction,
) => Promise<void>;
interface CommandBase {
	data: CommandData;
	execute?: CommandExecute;
}

interface AutocompletedCommand {
	autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
}
/**
 * The interface for a command.
 * @template Autocomplete Whether the command uses autocomplete. Defaults to `false`.
 */
export type CommandConstruct<Autocomplete extends boolean = false> =
	CommandBase & (Autocomplete extends true ? AutocompletedCommand : {});

//#endregion

//#region Events

/**
 * Creates an event construct for a given event.
 * @template E The event name to create an event for.
 * @param options The options for the event.
 * @param options.name The name of the event.
 * @param options.once Whether the event is once or not.
 * @param options.execute The function to call when the event is emitted.
 * @returns The event construct.
 */
export function createEvent<E extends keyof ClientEvents>({
	name,
	once,
	execute,
	onConnect,
}: {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
	onConnect?: () => Promise<void>;
}): EventConstruct<E> {
	return { name, once, execute, onConnect };
}
interface EventConstruct<E extends keyof ClientEvents> {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
	onConnect?: () => Promise<void>;
}
//#endregion

//#region Subcommands

export type SubcommandStructure = typeof subcommands;
/**
 * Recursively builds a union of all subcommand paths in a given {@link SubcommandMap}.
 *
 * This type takes a given {@link SubcommandMap} and recursively builds a union
 * of all subcommand paths. The paths are built by concatenating the subcommand
 * names with a space in between. If the subcommand is a group, the group name is
 * added to the path and the type recursively builds the union of all subcommands
 * in the group.
 *
 * @example
 * type paths = RecursiveSubcommandPaths<typeof subcommands>;
 * // paths is 'sub1' | 'sub2' | 'sub3' | 'group sub1' | 'group sub2' | 'group sub3'
 * @param T The subcommand map to build the union of subcommand paths from.
 * @param Prefix The prefix to add to the subcommand path.
 * @returns A union of all subcommand paths.
 */
export type RecursiveSubcommandPaths<T, Prefix extends string = ''> = {
	[K in keyof T]: T[K] extends Record<string, any>
		? RecursiveSubcommandPaths<T[K], `${Prefix}${K & string} `>
		: `${Prefix}${K & string}`;
}[keyof T];

export type SubcommandPaths = RecursiveSubcommandPaths<SubcommandStructure>;

export type SubcommandMap = {
	[key: string]: string | SubcommandMap;
};

//#endregion

//#region Generics

export type RecursiveFlatVals<T> =
	T extends Record<string, any>
		? { [K in keyof T]: RecursiveFlatVals<T[K]> }[keyof T]
		: T;
export type RecursiveFlatKeys<T> =
	T extends Record<string, any>
		? { [K in keyof T]: K | RecursiveFlatKeys<T[K]> }[keyof T]
		: never;

//#endregion

//#region Errors

/**
 * Always index this instead of using values directly, they may change!
 *
 * For constructing error messages, see {@link constructError}
 */
export const ErrorReplies = {
	UnknownError: 'An unexpected error has occurred.',
	PermissionError: 'You do not have permission to use this command.',
	CommandNotFound: 'Command not found.',
	ReportToOwner: `Please report this to the bot owner: <@${Config.get('appOwnerUsername')}>.`,
	PrefixWithError: 'Error: !{ERROR}',
	CommandNotFoundSubstitute: 'Command not found: \`!{ERROR}\`.',
	OutdatedCommand: 'This command cannot be used and may be outdated.',
	InteractionHasNoGuild:
		'This interaction does not have an associated guild.',
	SetupAlreadyComplete: 'This server is already set up.',
} as const;

//#endregion

//#region Database

//#endregion
