import {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	ClientEvents,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { getSubcommands } from './utils';
import { subcommands } from './commands';

//#region Commands
/*export function createCommand<T extends CommandData>({
	data,
	execute,
	autocomplete,
}: {
	data: CommandData;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
}): CommandConstruct<true>;
export function createCommand<T extends CommandData>({
	data,
	execute,
}: {
	data: CommandData;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}): CommandConstruct<false>;*/
export function createCommand<
	Autocomplete extends boolean,
	T extends CommandData,
	/*Name extends
		keyof SubcommandStructure = T['name'] extends keyof SubcommandStructure
		? T['name']
		: never,*/
>({
	data,
	execute,
	autocomplete,
	//subcommands: subcmdList,
}: {
	data: T;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	autocomplete: Autocomplete extends true
		? (interaction: AutocompleteInteraction) => Promise<void>
		: undefined;
	/*subcommands?: {
		[subcmd in keyof SubcommandStructure[Name]]: (
			interaction: ChatInputCommandInteraction,
		) => Promise<void>;
	};*/
}): CommandConstruct<Autocomplete> {
	const subcommands =
		// Check if there are subcommands
		'addSubcommand' in data
			? getSubcommands(data as SlashCommandBuilder)
			: {};
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
interface CommandBase {
	data: CommandData;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
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
export function createEvent<E extends keyof ClientEvents>({
	name,
	once,
	execute,
}: {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
}): EventConstruct<E> {
	return { name, once, execute };
}
interface EventConstruct<E extends keyof ClientEvents> {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
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
const test = {
	a: 1,
	b: {
		c: 2,
		d: {
			e: 3,
		},
	},
} as const;
type Test = RecursiveFlatKeys<typeof test>;
type Test2 = { [V in Test]: V };

//#endregion
