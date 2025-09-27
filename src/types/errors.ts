import { Transaction } from '@sequelize/core';
import { Config } from '../config.js';

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
		'This interaction does not have an associated guild. This may be because of an internal error or because the interaction was not created in a guild.',
	SetupAlreadyComplete: 'This server is already set up.',
	InteractionTimedOut: 'This interaction has timed out.',
	InteractionHasNoMember:
		'This interaction does not have an associated guild member. This may be because of an internal error or because the interaction was not created in a guild.',
	InteractionHasNoChannel:
		'This interaction does not have an associated channel. This may be because of an internal error or because the interaction was not created in a guild.',
	PermissionsNeededSubstitute: 'You need the following permissions to use this command: !{ERROR}',
	MustBeServerOwner: 'You must be the server owner to use this command.',
	ActivityCheckExists: 'An activity check already exists in this guild. Please delete that one first.',
	InvalidTimeFormat: 'Invalid time format, could not parse.',
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
