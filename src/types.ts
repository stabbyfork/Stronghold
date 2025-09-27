import { Op, Transaction } from '@sequelize/core';
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
	ClientEvents,
	ContainerBuilder,
	Guild,
	GuildMember,
	InteractionReplyOptions,
	MessagePayload,
	Role,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
	User,
	userMention,
} from 'discord.js';
import _ from 'lodash';
import { client } from './client.js';
import { CommandList } from './cmdOptions.js';
import { subcommands } from './commands.js';
import { createActivityCheckEmbed, getDefaultActivityCheckEmoji } from './commands/activity/checks/create.js';
import { createInactiveRoleIfMissing } from './commands/utility/setup.js';
import { Config } from './config.js';
import { Data } from './data.js';
import { hasPermissions, Permission, UsageLimit, UsageLimitParams } from './schema.js';
import { constructError, Debug, deepTransform, defaultEmbed } from './utils.js';

export enum ActivityCheckEvent {
	MessageInactive = 1,
	KickInactiveOverStrikesLimit = 2,
	DeleteCurrentMessage = 3,
	AddRoleToInactiveAndRemoveFromActive = 4,
	PingInactive = 5,
	SendNextMessage = 6,
}

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
	ReportToOwner: `Please report this to the bot owner: <@${Config.get('appOwnerId')}>.`,
	PrefixWithError: 'Error: \`!{ERROR}\`',
	OnlySubstitute: '\`!{ERROR}\`',
	CommandNotFoundSubstitute: 'Command not found: \`!{ERROR}\`.',
	OutdatedCommand: 'This command cannot be used and may be outdated.',
	InteractionHasNoGuild:
		'This interaction does not have an associated guild.\
		This may be because of an internal error or because the interaction was not created in a guild.',
	SetupAlreadyComplete: 'This server is already set up.',
	InteractionTimedOut: 'This interaction has timed out.',
	InteractionHasNoMember:
		'This interaction does not have an associated guild member.\
		This may be because of an internal error or because the interaction was not created in a guild.',
	InteractionHasNoChannel:
		'This interaction does not have an associated channel.\
		This may be because of an internal error or because the interaction was not created in a guild.',
	PermissionsNeededSubstitute: 'You need the following permissions to use this command: !{ERROR}',
	MustBeServerOwner: 'You must be the server owner to use this command.',
	ActivityCheckExists: 'An activity check already exists in this guild. Please delete that one first.',
	InvalidTimeFormat: 'Invalid time format, could not parse.',
	DurationTooShort: 'Duration too short.',
	DurationTooLong: 'Duration too long.',
	NotSetup: 'This server is not set up. Please run `/setup` first.',
	InvalidSequence:
		'Invalid activity check sequence. Please check the format and try again. \
	See `/activity checks info` for more information.',
	NoExistingActivityCheck: 'There is no activity check active. See `/activity checks create`.',
	IntervalWithoutSendNext: `When specifying an interval, you must also include \
	\`${ActivityCheckEvent[ActivityCheckEvent.SendNextMessage]}\` (\`${ActivityCheckEvent.SendNextMessage}\`) in the sequence \
	for checks to recur.`,
	NotOwnerOfInteraction: 'You did not create this interaction! You cannot interact with this.',
	TryAgain: 'Please try again later.',
	InvalidPermissionSubstitute:
		'Invalid permission name: !{ERROR}. See `/permissions info` for a list of possible permissions.',
	RoleNotFoundSubstitute: 'Role not found: !{ERROR}.',
	UserNotFoundSubstitute: 'User not found: !{ERROR}.',
	UserAlreadyHasPermissionsSubstitute: 'User already has the given permissions: !{ERROR}.',
	CouldNotCreateCollector: 'Could not create component collector.',
	NoResponse: 'No response received.',
	RankExistsSubstitute: 'A rank with name `!{ERROR}` already exists.',
	RankNotFoundSubstitute: 'Rank `!{ERROR}` not found.',
	NoRanks: 'No ranks found.',
	InvalidFileTypeSubstitute: 'Invalid file type. Must be: !{ERROR}.',
	InvalidFileFormatSeeHelp: 'Invalid file format. See the help entry of this command for more information.',
	CouldNotFetch: 'Could not fetch.',
	CooldownSubstitute: 'Please wait !{ERROR} before trying again.',
	NoDescription: 'Could not get description for command.',
	DMSendLimitReachedSubstitute: 'Sending DMs is rate limited. Try again in !{ERROR}.',
	InvalidColorSubstitute: 'Invalid color: !{ERROR}.',
	SeeHelp: 'See the help entry of this command for more information.',
	NoExistingSession: 'There is no session active. See `/session start`.',
	ChannelNotFoundSubstitute: 'Channel not found (id): !{ERROR}.',
	MessageNotFoundSubstitute: 'Message not found (id): !{ERROR}.',
} as const;

export namespace Errors {
	/**
	 * Thrown when there is a problem with the database.
	 */
	export class DatabaseError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'DatabaseError';
			Object.setPrototypeOf(this, DatabaseError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with an activity check.
	 */
	export class ActivityCheckError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ActivityCheckError';
			Object.setPrototypeOf(this, ActivityCheckError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with the sequence of events in an activity check.
	 *
	 * This error is thrown when the sequence of events in an activity check is invalid.
	 * This can be due to a variety of reasons, such as:
	 * - The sequence is not a string separated by {@link ActivityCheckSequence.SEPARATOR}
	 * - The sequence contains a duplicate event
	 * - The sequence contains an invalid event
	 */
	export class ActivityCheckSequenceError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ActivityCheckSequenceError';
			Object.setPrototypeOf(this, ActivityCheckSequenceError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with a command.

	 * This can be due to a variety of reasons.
	 */
	export class CommandError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'CommandError';
			Object.setPrototypeOf(this, CommandError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with a subcommand.

	 * This can be due to a variety of reasons.
	 */
	export class SubcommandError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'SubcommandError';
			Object.setPrototypeOf(this, SubcommandError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with a main command execute function.
	 */
	export class MainCommandError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'MainCommandError';
			Object.setPrototypeOf(this, MainCommandError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with validating a value.
	 *
	 * This error is thrown when a value does not meet the requirements
	 * of the validation function.
	 */
	export class ValidationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ValidationError';
			Object.setPrototypeOf(this, ValidationError.prototype);
		}
	}
	/**
	 * Thrown when there is a problem with a value.
	 *
	 * This error is thrown when a value is unknown or unexpected.
	 */
	export class ValueError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ValueError';
			Object.setPrototypeOf(this, ValueError.prototype);
		}
	}
	export class OutOfBoundsError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'OutOfBoundsError';
			Object.setPrototypeOf(this, OutOfBoundsError.prototype);
		}
	}
	export class NotAllowedError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'NotAllowedError';
			Object.setPrototypeOf(this, NotAllowedError.prototype);
		}
	}
	export class JSONError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'JSONError';
			Object.setPrototypeOf(this, JSONError.prototype);
		}
	}

	export class NotFoundError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'NotFoundError';
			Object.setPrototypeOf(this, NotFoundError.prototype);
		}
	}

	/** Not logged */
	export class ExpectedError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ExpectedError';
			Object.setPrototypeOf(this, ExpectedError.prototype);
		}
	}

	/** Extra data included */
	export class InformedError<DataType> extends Error {
		constructor(
			message: string,
			readonly data: DataType,
		) {
			super(message);
			this.name = 'InformedError';
			Object.setPrototypeOf(this, InformedError.prototype);
		}
	}

	/** Rollback if encountered */
	export class TransactionError extends InformedError<Transaction> {
		constructor(message: string, transaction: Transaction) {
			super(message, transaction);
			this.name = 'TransactionError';
			Object.setPrototypeOf(this, TransactionError.prototype);
		}
	}

	/** Thrown when there is a problem with a third-party API */
	export class ThirdPartyError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'NetworkError';
			Object.setPrototypeOf(this, ThirdPartyError.prototype);
		}
	}

	/** An error which has already been handled and does not need to be logged */
	export class HandledError extends ExpectedError {
		constructor(message: string) {
			super(message);
			this.name = 'HandledError';
			Object.setPrototypeOf(this, HandledError.prototype);
		}
	}
}

//#endregion

//#region Activity check sequence

// Validate
const _used = new Set();
for (const event of Object.values(ActivityCheckEvent)) {
	if (!_.isNumber(event)) {
		continue;
	}
	const evtName = ActivityCheckEvent[event as ActivityCheckEvent];
	if (event <= 0) {
		throw new Errors.ValidationError(`Below or equal to 0 activity check event: ${evtName}`);
	}
	if (_used.has(event)) {
		throw new Errors.ValidationError(`Duplicate activity check event: ${evtName}`);
	}
	_used.add(event);
}

export class ActivityCheckSequence {
	static readonly VERSION = '1.0.0';
	static readonly SEPARATOR = ' ';
	static readonly DEFAULT = new ActivityCheckSequence([ActivityCheckEvent.AddRoleToInactiveAndRemoveFromActive]);
	static readonly EVENT_HANDLERS = {
		[ActivityCheckEvent.MessageInactive]: async (args) => {
			const { guild, inactiveUsers } = args;
			inactiveUsers.forEach(async (u) => {
				if (
					await Data.models.User.findOne({
						where: {
							guildId: guild.id,
							userId: u,
							points: {
								[Op.gt]: 0,
							},
						},
					})
				)
					return;
				await guild.members.cache.get(u)?.send({
					embeds: [
						defaultEmbed()
							.setTitle('Inactivity Notice')
							.setDescription(
								`You have been marked as inactive in \`${guild.name}\` (${guild.vanityURLCode ? `https://discord.gg/${guild.vanityURLCode}` : `\`${guild.id}\``}). To be marked as active, simply react to the server's next activity check (or the current one if it will be run again).`,
							)
							.setColor('Yellow')
							.setThumbnail(guild.iconURL()),
					],
				});
			});
		},
		// Will not kick users with noInactivityKick
		[ActivityCheckEvent.KickInactiveOverStrikesLimit]: async (args) => {
			const { guild, inactiveUsers, transaction } = args;
			inactiveUsers.forEach(async (u) => {
				const userData = await Data.models.User.findOne({
					where: {
						guildId: guild.id,
						userId: u,
					},
					transaction,
				});
				const maxStrikes =
					(
						await Data.models.ActivityCheck.findOne({
							where: {
								guildId: guild.id,
							},
							attributes: ['maxStrikes'],
							transaction,
						})
					)?.maxStrikes ?? 3;
				if (userData && userData.inactivityStrikes > maxStrikes) {
					const user = guild.members.cache.get(u);
					if (!user) return;
					if (await hasPermissions(user, guild, true, Permission.NoInactivityKick)) return;
					await user.send({
						embeds: [
							defaultEmbed()
								.setTitle('Kicked for inactivity')
								.setDescription(
									`You have been marked as inactive in \`${guild.name}\` (\`${guild.id}\`) and exceeded the server's limit of \`${maxStrikes}\` strikes, and thus kicked. To be marked as active, react to the server's activity checks. You may join the server again at any time by using an invite link or asking ${userMention(guild.ownerId)} (by DM) for an invite.`,
								)
								.setColor('Red')
								.setImage(guild.iconURL()),
						],
					});
					await user.kick('Inactivity strike maximum exceeded');
					const inst = await Data.models.User.findOne({
						where: {
							guildId: guild.id,
							userId: u,
						},
						transaction,
					});
					if (inst) {
						inst.inactivityStrikes = 0;
						await inst.save();
					}
				}
			});
		},
		[ActivityCheckEvent.DeleteCurrentMessage]: async (args) => {
			const { guild } = args;
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
			});
			if (check?.currentMessageId) {
				const channel = await guild.channels.fetch(check.channelId);
				if (channel && channel.isTextBased()) {
					const message = await channel.messages.fetch(check.currentMessageId);
					if (message) {
						await message.delete();
					}
				}
				check.currentMessageId = null;
				await check.save();
			}
		},
		[ActivityCheckEvent.AddRoleToInactiveAndRemoveFromActive]: async (args) => {
			const { guild, inactiveUsers, activeUsers, transaction } = args;
			let inactiveRoleId = (
				await Data.models.Guild.findOne({
					where: {
						guildId: guild.id,
					},
				})
			)?.inactiveRoleId;
			if (!inactiveRoleId) {
				const created = await createInactiveRoleIfMissing(guild, transaction);
				if (!created) {
					Debug.error('Failed to create inactive role during activity check');
					return;
				}
				inactiveRoleId = created.id;
			}
			const inactiveRole = guild.roles.cache.get(inactiveRoleId!);
			if (!inactiveRole) {
				Debug.error('Inactive role not found during activity check');
				return;
			}
			inactiveUsers.forEach(async (u) => {
				const user = guild.members.cache.get(u) ?? (await guild.members.fetch(u));
				if (!user) return;
				if (!user.roles.cache.has(inactiveRole.id)) {
					await user.roles.add(inactiveRole, 'Did not react to an activity check, considered inactive');
				}
			});
			activeUsers.forEach(async (u) => {
				const user = guild.members.cache.get(u) ?? (await guild.members.fetch(u));
				if (!user) return;
				if (user.roles.cache.has(inactiveRole.id)) {
					await user.roles.remove(inactiveRole, 'Reacted to an activity check');
				}
			});
		},
		[ActivityCheckEvent.PingInactive]: async (args) => {
			const { guild, transaction } = args;
			const inactiveRole = await createInactiveRoleIfMissing(guild, transaction);
			if (!inactiveRole) {
				Debug.error('Failed to create inactive role during activity check');
				return;
			}
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
				transaction,
			});
			if (!check) {
				Debug.error('No activity check found for guild');
				return;
			}
			const channel = guild.channels.cache.get(check.channelId);
			if (channel && channel.isSendable()) {
				channel.send({
					content: `<@&${inactiveRole.id}>`,
				});
			}
		},
		[ActivityCheckEvent.SendNextMessage]: async (args) => {
			const { guild, transaction } = args;
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
				transaction,
			});
			if (!check) {
				Debug.error('No activity check found for guild');
				return;
			}
			try {
				const channel = await (await client.guilds.fetch(check.guildId)).channels.fetch(check.channelId);
				const maxStrikes = check.maxStrikes;
				if (channel && channel.isSendable()) {
					const msg = await channel.send(
						createActivityCheckEmbed(getDefaultActivityCheckEmoji(), maxStrikes),
					);
					await msg.react(getDefaultActivityCheckEmoji());
					check.currentMessageId = msg.id;
					await check.save();
				}
			} catch (e) {
				Debug.error('Error while sending activity check:', e);
			}
		},
	} satisfies {
		[K in ActivityCheckEvent]: (info: {
			guild: Guild;
			activeUsers: Set<string>;
			inactiveUsers: Set<string>;
			transaction: Transaction;
		}) => Promise<void>;
	};
	constructor(private readonly sequence: ActivityCheckEvent[]) {}
	/**
	 * Serialises the {@link ActivityCheckSequence} into a spaced string, separated by commas.
	 *
	 * @returns The serialised {@link ActivityCheckSequence}.
	 * @property sequence - The sequence of events, formatted as a string.
	 * @property version - The version of the serialised format.
	 * @throws If an invalid event is found.
	 */
	prettyPrint() {
		const out = {
			sequence: '',
			version: ActivityCheckSequence.VERSION,
		};
		const evtList: string[] = [];
		for (const evt of this.getSequence()) {
			const evtName = ActivityCheckEvent[evt];
			evtList.push(evtName);
		}
		out.sequence = evtList.map((e) => `${_.startCase(e)}`).join(', ');
		return out;
	}
	toString() {
		return this.sequence.join(ActivityCheckSequence.SEPARATOR);
	}
	/**
	 * Parses a string into an {@link ActivityCheckSequence}.
	 * @param sequence A string, separated by {@link ActivityCheckSequence.SEPARATOR}, containing the events to run.
	 * @throws {Errors.ActivityCheckSequenceError} If the sequence is invalid.
	 * @returns An {@link ActivityCheckSequence} object.
	 */
	static fromString(sequence: string) {
		if (!ActivityCheckSequence.isValid(sequence)) {
			throw new Errors.ActivityCheckSequenceError('Invalid sequence.');
		}
		const evtArr = sequence.split(ActivityCheckSequence.SEPARATOR).map((e) => {
			let num: number;
			if (typeof ActivityCheckEvent[e as keyof typeof ActivityCheckEvent] === 'number') {
				num = ActivityCheckEvent[e as keyof typeof ActivityCheckEvent];
			} else {
				num = parseInt(e);
			}
			return num;
		});
		return new ActivityCheckSequence(evtArr);
	}
	/**
	 * Returns the sequence of activity check events.
	 *
	 * @returns Sequence of events.
	 */
	getSequence() {
		return this.sequence;
	}

	/**
	 * Checks if a sequence string is valid.
	 *
	 * A sequence is considered valid if it:
	 * - Is a string, separated by {@link ActivityCheckSequence.SEPARATOR}, containing the events to run.
	 * - Has no duplicate events.
	 * - Every event is a valid {@link ActivityCheckEvent}, either a string or number.
	 *
	 * @param sequence The sequence string to validate.
	 * @returns True if the sequence is valid, false otherwise.
	 */
	static isValid(sequence: string) {
		const evtArr = sequence.split(ActivityCheckSequence.SEPARATOR);
		const used = new Set<number>();
		for (const evt of evtArr) {
			let num: number;
			if (typeof ActivityCheckEvent[evt as keyof typeof ActivityCheckEvent] === 'number') {
				num = ActivityCheckEvent[evt as keyof typeof ActivityCheckEvent];
			} else {
				num = parseInt(evt);
				if (ActivityCheckEvent[num] === undefined) return false;
			}
			if (used.has(num)) return false;
			used.add(num);
		}
		return true;
	}
}

//#endregion

//#region Commands

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
	autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
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
type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
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
	[option: string]: CommandChoiceDeclare<OptionType> | CommandOptionDeclare<OptionType>;
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
	autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
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

//#region Events

export enum GlobalCustomIds {
	InSessionButton = 'in-session-button',
}

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

/**
 * Recursively gets all values of a given object.
 *
 * This type takes a given object and recursively gets all values of the object.
 * If the object is not a record, it is returned as-is.
 *
 * @example
 * // Given: { a: { b: { c: 1 } } }
 * // Returns: 1
 * @example
 * // Given: { a: 1, b: { c: 2 } }
 * // Returns: 1 | 2
 *
 * @param T The object to get the values of.
 * @returns The values of the object.
 */
export type RecursiveFlatVals<T> =
	T extends Record<string, any> ? { [K in keyof T]: RecursiveFlatVals<T[K]> }[keyof T] : T;
/**
 * Recursively gets all keys of a given object.
 *
 * This type takes a given object and recursively gets all keys of the object.
 * If the object is not a record, it is returned as `never`.
 *
 * @example
 * // Given: { a: { b: { c: 1 } } }
 * // Returns: 'a' | 'b' | 'c'
 * @example
 * // Given: { a: 1, b: { c: 2 } }
 * // Returns: 'a' | 'b' | 'c'
 *
 * @param T The object to get the keys of.
 * @returns The keys of the object.
 */
export type RecursiveFlatKeys<T> =
	T extends Record<string, any> ? { [K in keyof T]: K | RecursiveFlatKeys<T[K]> }[keyof T] : never;

export type ValueOf<T> = T[keyof T];
export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? RecursivePartial<U>[]
		: T[P] extends object | undefined
			? RecursivePartial<T[P]>
			: T[P];
};

//#endregion

//#region Logging

const LogMessages = {} as const satisfies { [name: string]: MessagePayload | InteractionReplyOptions | string };

export namespace Logging {}

//#endregion

//#region Pages

export type Page = ContainerBuilder;
export type CreatePageFunction = (index: number, itemsPerPage: number) => Promise<Page>;

//#endregion
