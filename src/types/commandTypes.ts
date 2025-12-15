//#region Commands

import {
	APIApplicationCommandOption,
	APIApplicationCommandOptionChoice,
	APIApplicationCommandSubcommandGroupOption,
	APIApplicationCommandSubcommandOption,
	ApplicationCommandOptionType,
	Attachment,
	AutocompleteInteraction,
	Channel,
	ChatInputCommandInteraction,
	GuildMember,
	Role,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
	User,
} from 'discord.js';
import { CommandList } from '../cmdOptions.js';
import { deepTransform } from '../utils/genericsUtils.js';
import { UsageLimit, UsageLimitParams } from '../utils/usageLimitsUtils.js';
import { RecursivePartial } from './generics.js';

export type OptionType = keyof CommandOptionStrToType;

export function optionToType(option: APIApplicationCommandOption): OptionType | undefined {
	const type = option.type as ApplicationCommandOptionType;
	switch (type) {
		case ApplicationCommandOptionType.Attachment:
			return 'attachment';
		case ApplicationCommandOptionType.Channel:
			return 'channel';
		case ApplicationCommandOptionType.Role:
			return 'role';
		case ApplicationCommandOptionType.User:
			return 'user';
		case ApplicationCommandOptionType.Integer:
			return 'integer';
		case ApplicationCommandOptionType.Number:
			return 'number';
		case ApplicationCommandOptionType.String:
			return 'string';
		case ApplicationCommandOptionType.Boolean:
			return 'boolean';
		default:
			return undefined;
	}
}

function constructCommandOption(
	option: APIApplicationCommandOption,
): CommandOptionDeclare<OptionType> | CommandChoiceDeclare<OptionType> {
	const choices = (option as any).choices as APIApplicationCommandOptionChoice[];
	const type = optionToType(option);
	if (!type) {
		throw new Error(`Unknown option type: ${option.type}`);
	}
	if (choices) {
		return { required: option.required ?? true, choices, type };
	}
	return { type, required: option.required ?? true };
}

/*export function createCommand<
    P extends CommandOptionDict<T>,
    T extends OptionType = OptionType,
>({
    data,
    execute,
    autocomplete,
}: {
    data: CommandData;
    execute?: (
        interaction: ChatInputCommandInteraction,
        args: P & { value?: T; chosenIndex?: number },
    ) => Promise<void>;
    autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
}): CommandConstruct<true, P>;
export function createCommand<
    P extends CommandOptionDict<T>,
    T extends OptionType = OptionType,
>({
    data,
    execute,
}: {
    data: CommandData;
    execute?: (
        interaction: ChatInputCommandInteraction,
        args: P & { value?: T; chosenIndex?: number },
    ) => Promise<void>;
}): CommandConstruct<false, P>;*/
/**
 * Creates a new command construct
 *
 * @param data The data for the command
 * @param execute The execute function for the command
 * @param autocomplete The autocomplete function for the command. If not provided, then the command will not have autocomplete support.
 * @returns The command construct
 */
export function createCommand<
	P extends CommandOptionDictDeclare,
	O extends keyof CommandList<string> = keyof CommandList<string>,
>({
	data,
	execute,
	autocomplete,
	description,
	once,
	limits,
}: {
	data: CommandData;
	execute?: (interaction: ChatInputCommandInteraction, args: P) => Promise<void>;
	autocomplete?:
		| RecursivePartial<CommandList<(interaction: AutocompleteInteraction) => Promise<void>>[O]>
		| ((interaction: AutocompleteInteraction) => Promise<void>);
	description?: RecursivePartial<CommandList<string>[O]> | string;
	limits?: RecursivePartial<CommandList<UsageLimitParams>[O]> | UsageLimitParams;
	once?: () => Promise<void>;
}): CommandConstruct<boolean, P> {
	const rawOptions = data.toJSON().options ?? [];
	const options = {} as OptionList;
	// Ignore the mess, it works
	// TODO: Add choice compatibility
	for (const option of rawOptions) {
		if (
			option.type === ApplicationCommandOptionType.SubcommandGroup ||
			option.type === ApplicationCommandOptionType.Subcommand
		) {
			for (const sub of (
				option as APIApplicationCommandSubcommandGroupOption | APIApplicationCommandSubcommandOption
			).options ?? []) {
				if (sub.type === ApplicationCommandOptionType.Subcommand) {
					for (const subsub of (sub as APIApplicationCommandSubcommandOption).options ?? []) {
						const opt = constructCommandOption(subsub);
						if (opt) {
							options[option.name] = options[option.name] ?? {};
							(options[option.name] as any)[sub.name] = (options[option.name] as any)[sub.name] ?? {};
							(options[option.name] as any)[sub.name][subsub.name] = opt;
						}
					}
				} else {
					const opt = constructCommandOption(sub);
					if (opt) {
						options[option.name] = options[option.name] ?? {};
						(options[option.name] as any)[sub.name] = opt;
					}
				}
			}
		} else {
			const opt = constructCommandOption(option);
			if (opt) {
				(options[option.name] as any) = opt;
			}
		}
	}
	let constructedLims: RecursivePartial<CommandList<UsageLimit>[O]> | undefined = undefined;
	if (limits) {
		constructedLims = deepTransform(
			limits,
			(v) => typeof v === 'object' && v !== null && 'intervalMs' in v && 'usesPerInterval' in v,
			(v) => new UsageLimit(v as UsageLimitParams),
		) as RecursivePartial<CommandList<UsageLimit>[O]>;
	}

	if (autocomplete === undefined) {
		return { data, execute, options, description, once, limits: constructedLims };
	} else {
		return { data, execute, autocomplete, options, description, once, limits: constructedLims };
	}
}
export type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
export type CommandExecute<Args extends CommandOptionDictDeclare | void = void> = (
	interaction: ChatInputCommandInteraction,
	args: Args,
) => Promise<void>;

export interface CommandOptionStrToType {
	string: string;
	integer: number;
	boolean: boolean;
	user: User;
	member: GuildMember;
	channel: Channel;
	role: Role;
	number: number;
	attachment: Attachment;
}
/*export type CommandOption<
    Choices extends boolean = false,
    T extends OptionType = OptionType,
    Required extends boolean = false,
> = (Choices extends true
    ? {
            choices: APIApplicationCommandOptionChoice[];
            chosenIndex?: number;
        }
    : {
            value?: CommandOptionStrToType[T];
        }) & {
    type: Required extends true ? T : T | null;
    required: Required;
    defaultValue?: CommandOptionStrToType[T];
};*/

export type CommandOptionDeclare<T extends OptionType, Required extends boolean = boolean> = {
	type: Required extends true ? T : T | null;
	required: Required;
	defaultValue?: CommandOptionStrToType[T];
	choices?: APIApplicationCommandOptionChoice[];
};

export type CommandChoiceDeclare<T extends OptionType, Required extends boolean = boolean> = {
	type: Required extends true ? T : T | null;
	required: Required;
	choices: APIApplicationCommandOptionChoice[];
	defaultValue?: CommandOptionStrToType[T];
};

export type CommandOption<T extends OptionType, Required extends boolean = boolean> = CommandOptionDeclare<
	T,
	Required
> & {
	value: Required extends true ? CommandOptionStrToType[T] : CommandOptionStrToType[T] | null;
};

export type CommandChoice<T extends OptionType, Required extends boolean = boolean> = CommandChoiceDeclare<
	T,
	Required
> & {
	value: Required extends true ? string : string | null;
};

export type CommandOptionDictDeclare = {
	[option: string]: CommandOptionDeclare<OptionType>;
};

export type CommandOptionDict = {
	[option: string]: CommandChoice<OptionType> | CommandOption<OptionType>;
};

export type OptionList<T = CommandOptionDictDeclare> =
	| {
			[sub1: string]:
				| {
						[sub2: string]: T;
				  }
				| T;
	  }
	| T;
interface CommandBase<Args extends CommandOptionDictDeclare | void = void> {
	data: CommandData;
	options: OptionList;
	execute?: CommandExecute<Args>;
	once?: () => Promise<void>;
	/** Long description */
	description?: RecursivePartial<CommandList<string>[keyof CommandList<string>]> | string;
	limits?: RecursivePartial<CommandList<UsageLimit>[keyof CommandList<any>]> | UsageLimit;
}

interface AutocompletedCommand {
	autocomplete:
		| RecursivePartial<CommandList<(interaction: AutocompleteInteraction) => Promise<void>>[keyof CommandList<any>]>
		| ((interaction: AutocompleteInteraction) => Promise<void>);
}
/**
 * The interface for a command.
 * @template Autocomplete Whether the command uses autocomplete. Defaults to `false`.
 */
export type CommandConstruct<
	Autocomplete extends boolean = false,
	Args extends CommandOptionDictDeclare | void = void,
> = CommandBase<Args> & (Autocomplete extends true ? AutocompletedCommand : {});

//#endregion
