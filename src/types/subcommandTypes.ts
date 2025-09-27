//#region Subcommands

import { subcommands } from '../commands.js';

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
