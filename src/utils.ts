import {
	APIApplicationCommandSubcommandGroupOption,
	ApplicationCommandOptionType,
	EmbedBuilder,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
} from 'discord.js';
import { appOwnerId } from './config.json';
import {
	RecursiveFlatKeys,
	RecursiveFlatVals,
	SubcommandMap,
	SubcommandStructure,
} from './types';
import { subcommands } from './commands';

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
			text: `Created by a bot, developed by <@${appOwnerId}>.`,
		})
		.setTimestamp();
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
export function flattenKeys<
	T extends Record<any, any>,
	R extends { [V in RecursiveFlatKeys<T>]: V },
>(obj: T): R {
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
export function flattenVals<
	T extends Record<any, any>,
	R extends { [V in RecursiveFlatVals<T>]: V },
>(obj: T): R {
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
export function getSubcommands(
	command: SlashCommandBuilder,
	split: string = ' ',
): SubcommandMap | string {
	const json = command.toJSON() as RESTPostAPIApplicationCommandsJSONBody;

	const map: SubcommandMap = {};

	for (const option of json.options ?? []) {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			// Top level subcommand
			map[option.name] = command.name.concat(split, option.name);
		} else if (
			option.type === ApplicationCommandOptionType.SubcommandGroup
		) {
			// Subcommand group
			const group: SubcommandMap = {};
			for (const sub of (
				option as APIApplicationCommandSubcommandGroupOption
			).options ?? []) {
				if (sub.type === ApplicationCommandOptionType.Subcommand) {
					group[sub.name] = [
						command.name,
						option.name,
						sub.name,
					].join(split);
				}
			}
			map[option.name] = group;
		}
	}

	return length(map) === 0 ? command.name : map;
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

function buildCommandFromStructure(
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
}

//#endregion
