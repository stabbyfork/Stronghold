//#region Subcommands

import {
	ChatInputCommandInteraction,
	AutocompleteInteraction,
	Guild,
	SlashCommandBuilder,
	RESTPostAPIApplicationCommandsJSONBody,
	ApplicationCommandOptionType,
	APIApplicationCommandSubcommandGroupOption,
} from 'discord.js';
import { commandOptions } from '../cmdOptions.js';
import { subcommands, commands } from '../commands.js';
import { Data } from '../data.js';
import { CommandOptionDictDeclare, CommandOptionStrToType, CommandExecute } from '../types/commandTypes.js';
import { ErrorReplies } from '../types/errors.js';
import { SubcommandMap, SubcommandStructure } from '../types/subcommandTypes.js';
import { capitalise, length } from './genericsUtils.js';
import { reportErrorToUser, constructError, Debug } from './errorsUtils.js';

/**
 * Retrieves the full name of a command from a given interaction.
 *
 * This function constructs the full command name by appending the command name,
 * subcommand group (if any), and subcommand (if any) with a specified delimiter.
 * If the command doesn't exist in the subcommands map, only the command name is returned.
 *
 * @param interaction The interaction to extract the command name from.
 * @param split The delimiter used to join command components. Defaults to a space.
 * @returns The full command name as a string.
 */
export function getCommandFullName(interaction: ChatInputCommandInteraction | AutocompleteInteraction) {
	if (!(interaction.commandName in subcommands)) return [interaction.commandName];
	const group = interaction.options.getSubcommandGroup();
	const sub = interaction.options.getSubcommand();
	const name = [interaction.commandName];
	if (group) name.push(group);
	if (sub) name.push(sub);
	return name;
}

export function getAllOptionsOfCommand(interaction: ChatInputCommandInteraction) {
	let options: CommandOptionDictDeclare = {};
	let current: {} = commandOptions;
	for (const splitted of getCommandFullName(interaction)) {
		current = current[splitted as keyof typeof current];
		if (!current) continue;
		const firstVal = Object.values(current)[0];
		if (firstVal && typeof firstVal === 'object' && 'type' in firstVal && 'required' in firstVal) {
			options = { ...current };
			break;
		}
	}
	return options;
}

/**
 * Checks if the interaction is from a guild and if the guild is set up.
 * If either condition is not met, an error is reported to the user.
 * @param interaction The interaction to check.
 * @returns A boolean indicating whether the guild is set up. (true = setup ready)
 */
export async function reportErrorIfNotSetup(interaction: ChatInputCommandInteraction) {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return false;
	}
	if (!(await isSetup(guild))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NotSetup]), true);
		return false;
	}
	return true;
}

export async function isSetup(guild: Guild) {
	if (
		(await Data.models.Guild.findOne({
			where: { guildId: guild.id, ready: true },
		})) === null
	)
		return false;
	return true;
}

export function getOption<
	P extends CommandOptionDictDeclare,
	N extends keyof P,
	T extends keyof CommandOptionStrToType | null = P[N]['type'],
>(
	interaction: ChatInputCommandInteraction,
	args: P,
	name: N,
): P[N]['required'] extends true
	? CommandOptionStrToType[NonNullable<T>]
	: CommandOptionStrToType[NonNullable<T>] | null {
	const required = args[name].required;
	const type = args[name].type ?? '';
	const defaultVal = args[name].defaultValue ?? null;
	const method = `get${capitalise(type)}` as keyof ChatInputCommandInteraction['options'];

	// @ts-expect-error: dynamic method call is valid
	return interaction.options[method](name, required) ?? defaultVal;
}

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
 * command has subcommands.
 */
export function getSubcommandExec(
	interaction: ChatInputCommandInteraction,
): [CommandExecute<CommandOptionDictDeclare>, found: boolean, hasSubcommands: boolean] {
	if (!(interaction.commandName in subcommands)) {
		const exec = commands?.[interaction.commandName as keyof typeof commands]?.execute;
		if (exec) {
			return [exec as CommandExecute<CommandOptionDictDeclare>, true, false];
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
		const subcmd = groupSubcmds[command as keyof typeof groupSubcmds] as
			| CommandExecute<CommandOptionDictDeclare>
			| undefined;
		if (typeof subcmd !== 'function') return [_notFoundFunc(interaction), false, false];
		return [subcmd, true, true];
	} else {
		const cmds = subcommands[interaction.commandName as keyof SubcommandStructure];
		const subcmd = cmds[command as keyof typeof cmds] as CommandExecute<CommandOptionDictDeclare> | undefined;
		if (typeof subcmd !== 'function') return [_notFoundFunc(interaction), false, false];
		return [subcmd, true, true];
	}
}

//#endregion
