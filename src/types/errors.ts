import { Transaction } from '@sequelize/core';
import { Config } from '../config.js';
import { PermissionsBitField } from 'discord.js';

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
	ReportToOwner: `Please report this to the bot developers. You can use the \`/feedback\` command or get support at ${Config.get('website').discordUrl}.`,
	PrefixWithError: 'Error: \`!{ERROR}\`',
	OnlySubstitute: '\`!{ERROR}\`',
	CommandNotFoundSubstitute: 'Command not found: \`!{ERROR}\`.',
	OutdatedCommand: 'This command cannot be used and may be outdated.',
	InteractionHasNoGuild:
		'This interaction does not have an associated guild. This may be because of an internal error or because the interaction was not created in a guild.',
	SetupAlreadyComplete: 'This server is already set up. To redo the setup, run `/setup force: true`.',
	InteractionTimedOut: 'This interaction has timed out.',
	InteractionHasNoMember:
		'This interaction does not have an associated guild member. This may be because of an internal error or because the interaction was not created in a guild.',
	InteractionHasNoChannel:
		'This interaction does not have an associated channel. This may be because of an internal error or because the interaction was not created in a guild.',
	PermissionsNeededSubstitute: 'You need the following permission(s) to use this command: \`!{ERROR}\`',
	MustBeServerOwner: 'You must be the server owner to use this command.',
	ActivityCheckExists: 'An activity check already exists in this guild. Please delete that one first.',
	InvalidTimeFormat: 'Invalid time format, could not parse. Use this format: `10m`, `5h`, `1d`, etc.',
	DurationTooShort: 'Duration too short.',
	DurationTooLong: 'Duration too long.',
	NotSetup: 'This server is not set up. Please run `/setup` first.',
	InvalidSequence:
		'Invalid activity check sequence. Please check the format and try again. See `/activity checks info` for more information.',
	NoExistingActivityCheck: 'There is no activity check active. See `/activity checks create`.',
	IntervalWithoutSendNext: `When specifying an interval, you must also include \`SendNextMessage\` (\`6\`) in the sequence for checks to recur.`,
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
	NoExistingSession: 'There is no active session. See `/session start`.',
	ChannelNotFoundSubstitute: 'Channel not found: !{ERROR}.',
	MessageNotFoundSubstitute: 'Message not found: !{ERROR}.',
	CantBeStackableAndLimited: 'Role cannot be stackable and limited at the same time.',
	DiploNotSetup: 'Diplomacy is not set up. Please run `/dpm setup` first.',
	DiploAlreadySetup: 'Diplomacy is already set up.',
	GuildNotRelated: 'Guild with the tag \`!{ERROR}\` is not related to this server.',
	GuildTagNotFound: 'Guild with the tag \`!{ERROR}\` not found.',
	InternalError: 'An internal error occurred.',
	InteractionHasNoTargetGuild:
		'This interaction does not have an associated target guild. This may be because of an internal error.',
	NoAllianceRequest: 'There is no active alliance request for this guild.',
	NoNeutralRequest: 'There is no active peace request for this guild.',
	AlreadyAllied: 'You are already allied with this guild.',
	AlreadyNeutral: 'You are already at peace with this guild.',
	UserNotInSession: 'This user is not in the session.',
	UserHasNotJoinedSession: 'This user has not joined the session.',
	ClientPermissionsMissingSubstitute: 'The bot requires the following permissions: !{ERROR}.',
	RoleIsHigherThanClientSubstitute:
		"Cannot manage roles above the bot's highest role. You can either move the role(s) below the bot's highest role or move the bot's highest role higher.",
	ClientUserNotFoundInGuild: "Could not find the bot's user in this guild.",
	RelationChangeInProgress: 'A relation change is already in progress. Cancel that one before starting another.',
	MessageTooShort: 'Message is too short.',
	MessageTooLong: 'Message is too long. It may be a maximum of 2000 characters.',
	UserAlreadyBlacklisted: 'User is already blacklisted.',
	UserNotBlacklisted: 'User is not blacklisted.',
	RobloxUserNotFound: 'Roblox user with the username \`!{ERROR}\` could not be found.',
	NoUsernamesProvided: 'No usernames provided. Separate usernames with spaces.',
	TooManyUsernamesProvided: 'Too many usernames provided. Maximum of 10 usernames are allowed to be checked at once.',
	ProxyNameTooLong: 'Proxy name is too long. It may be a maximum of 32 characters.',
	ProxyTargetTooLong: 'Proxy target is too long. It may be a maximum of 32 characters.',
	InvalidProxyTarget: 'Invalid proxy target. \`!{ERROR}\` is not a valid command.',
	ProxyLimit: 'You cannot add more than 50 command proxies to one server.',
	NoProxies: 'No custom names for commands found. Use \`/proxy add\` to add one.',
	InvalidProxy: 'Invalid command proxy: \`!{ERROR}\` is not a valid command. Please redo the proxy setup.',
	ProxyNameExists: 'A command with the name \`!{ERROR}\` already exists.',
	ProxyTargetNotSubcommand: 'Target command is not a subcommand. Please only target commands or subcommands.',
	SessionNotCreated: 'A session has not been created yet. Please run `/session start` first.',
	ProxyNotFoundSubstitute: 'Proxy command not found: `!{ERROR}`',
	GroupNameEmpty: 'Group name cannot be empty.',
	PrefixTooLong: 'Prefix is too long. It may be a maximum of 16 characters.',
	PrefixEmpty: 'Prefix cannot be empty.',
	NoPrefixesSet: 'No prefixes have been set in this server. See `/ranking prefix add` to add one.',
	PrefixNotSetForRole: 'No prefix has been set for the role with ID `!{ERROR}`.',
	InteractionHasNoGroupId:
		'This interaction does not have an associated group ID. This may be because of an internal error.',
	UserAlreadyInGroup: 'You are already in this group.',
	GroupNotJoinable: 'This group is not joinable.',
	GroupJoinNeedsApprovalButNoLogChannel:
		'This group requires approval to join, but no log channel is set up to log the join requests. The server owner needs to run `/setup force:true` and make sure to set a log channel to use this feature.',
	FailedToCreateLogThread:
		'Failed to create a log thread. Please make sure the bot has permission to manage threads in the logging channel and try again.',
	GroupHasInvalidRoles:
		'This group has invalid roles with the following IDs: !{ERROR}. Please fix or remove these roles to use this group.',
	InteractionHasNoGroupIdOrUserId:
		'This interaction does not have an associated group ID or user ID. This may be because of an internal error.',
	InteractionHasNoMatchingGroup:
		'No group found matching the group ID of this interaction. This may be because of an internal error or because the group was deleted.',
	ThirdPersonUserAlreadyInGroup: 'This user is already in this group.',
	FailedToEditMessage:
		'Failed to edit the message for this interaction. This may be due to a permissions issue, because the interaction has expired, or because of an internal error.',
	FailedToGetHighestBotRole:
		'Failed to get the highest role of the bot. This may be because of an internal error or because the bot does not have any roles in this server.',
	FailedToGetUserHighestRole:
		'Failed to get the highest role of the user. This may be because of an internal error or because the user does not have any roles in this server.',
	GroupHasRoleHigherThanBot:
		"This group has a role that is higher than or equal to the bot's highest role. The bot cannot manage roles that are higher than or equal to its highest role. Move the role(s) in this group below the bot's highest role or move the bot's roles higher.",
	GroupHasRoleHigherThanUser:
		'This group has a role that is higher than or equal to your highest role. You cannot approve groups that have roles higher than or equal to your highest role.',
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

	export class DPMError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'DPMError';
			Object.setPrototypeOf(this, DPMError.prototype);
		}
	}
	/** Thrown when the bot does not have proper permissions to do something */
	export class PermissionError extends InformedError<PermissionsBitField> {
		constructor(message: string, requiredPermissions: PermissionsBitField) {
			super(message, requiredPermissions);
			this.name = 'PermissionError';
			Object.setPrototypeOf(this, PermissionError.prototype);
		}
	}
}
//#endregion
