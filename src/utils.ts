import {
	ActionRowBuilder,
	APIApplicationCommandSubcommandGroupOption,
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	ColorResolvable,
	ComponentType,
	EmbedBuilder,
	ForumChannel,
	ForumThreadChannel,
	Guild,
	Interaction,
	InteractionCallbackResponse,
	InteractionReplyOptions,
	MessageActionRowComponentBuilder,
	MessageComponentType,
	MessageCreateOptions,
	MessageFlags,
	MessagePayload,
	RepliableInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
	TextDisplayBuilder,
	ThreadAutoArchiveDuration,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import parseDuration from 'parse-duration';
import Sequelize, { col, Op, sql } from '@sequelize/core';
import { client } from './client.js';
import { commandOptions } from './cmdOptions.js';
import { commands, subcommands } from './commands.js';
import { Config } from './config.js';
import { Data } from './data.js';
import {
	ActivityCheckSequence,
	CommandExecute,
	CommandOptionDictDeclare,
	CommandOptionStrToType,
	CreatePageFunction,
	ErrorReplies,
	Errors,
	Page,
	RecursiveFlatKeys,
	RecursiveFlatVals,
	SubcommandMap,
	SubcommandStructure,
	ValueOf,
} from './types.js';
import { checkBits, GuildFlag, GuildFlagBits, GuildFlagField, includesGuildFlags } from './schema.js';
import { Guild as GuildModel } from './models/guild.js';

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
			text: `Created by a bot, developed by @${Config.get('appOwnerUsername')}`,
		})
		.setTimestamp();
}

export function isSameUser(inter1: Interaction, inter2: Interaction) {
	return inter1.user.id === inter2.user.id;
}

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

export async function runActivityCheckExecute(
	guildId: string,
	channelId: string,
	currentMessageId: string,
	sequence: string,
) {
	try {
		const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
		if (!guild) {
			Debug.error(`Guild ${guildId} not found`);
			return;
		}
		const channel = await guild.channels.fetch(channelId);
		if (!(channel && channel.isTextBased())) {
			// TODO: Invalidate the activity check and notify
			Debug.error(`Channel ${channelId} not found or not a text channel`);
			return;
		}
		const msg = await channel.messages.fetch(currentMessageId);
		const reactedUsers = new Set(
			(await Promise.all(msg.reactions.cache.map(async (r) => await r.users.fetch())))
				.flatMap((users) => users.map((u) => u.id))
				.filter((u) => u !== client.user?.id),
		);

		const inactiveUsers = new Set<string>();
		const allUsers = (await guild.members.fetch()).filter(
			(u) => !(u.id === client.user?.id || u.id === guild.ownerId || u.user.bot),
		);
		allUsers.forEach((u) => {
			if (!reactedUsers.has(u.id)) {
				inactiveUsers.add(u.id);
			}
		});
		const reactedArray = Array.from(reactedUsers);
		await Data.mainDb.transaction(async (transaction) => {
			await Data.models.User.bulkCreate(
				allUsers.map((u) => ({
					guildId: guild.id,
					userId: u.id,
					inactivityStrikes: 0,
				})),
				{
					transaction,
					ignoreDuplicates: true,
				},
			);
			await Data.models.User.increment('inactivityStrikes', {
				where: {
					guildId: guild.id,
				},
				by: 1,
				transaction,
			});
			await Data.models.User.bulkCreate(
				reactedArray.map((u) => ({
					guildId: guild.id,
					userId: u,
					inactivityStrikes: 0,
				})),
				{
					transaction,
					updateOnDuplicate: ['inactivityStrikes'],
				},
			);
			const args = { guild, activeUsers: reactedUsers, inactiveUsers, transaction };
			for (const evt of ActivityCheckSequence.fromString(sequence).getSequence() ?? []) {
				await ActivityCheckSequence.EVENT_HANDLERS[evt](args);
			}
		});
	} catch (e) {
		Debug.error('Error while running activity check:', e, 'Guild:', guildId, 'Channel:', channelId);
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

const enum CustomIds {
	PageFirst = 'page-first',
	PagePrevious = 'page-previous',
	PageNext = 'page-next',
	PageLast = 'page-last',
}

export class Pages {
	/**
	 * Unformatted cached pages, not created if `cachePages` is false
	 */
	private readonly pages: Map<number, Page> = new Map();
	private currentPageI = 0;
	readonly itemsPerPage: number;
	private totalItems?: number;
	private readonly createPage: (index: number) => Promise<Page>;
	/**
	 * Whether or not pages should be cached (memory hungry, but faster)
	 */
	private readonly cachePages: boolean;
	/**
	 * Highest page added or visited
	 */
	private highestPage = 0;

	/**
	 * The highest page number that can be displayed.
	 *
	 * If the total number of items is not set, this will be `Infinity`.
	 * Otherwise, it is the total number of items divided by the number of items
	 * to display per page, rounded up to the nearest whole number, minus one.
	 */
	get maxPage() {
		if (this.totalItems === undefined) return Infinity;
		return Math.max(Math.ceil(this.totalItems / this.itemsPerPage) - 1, 0);
	}

	async getFormattedPage() {
		const page = this.cachePages
			? (this.pages.get(this.currentPageI) ??
				(await (async () => {
					const newPage = await this.createPage(this.currentPageI);
					this.pages.set(this.currentPageI, newPage);
					return newPage;
				})()))
			: await this.createPage(this.currentPageI);
		page.spliceComponents(
			0,
			0,
			new TextDisplayBuilder({
				content: `### Page ${this.currentPageI + 1}${this.maxPage !== Infinity ? `/${this.maxPage + 1}` : ''}${this.cachePages ? ' (cached)' : ''}`,
			}),
		);
		page.addActionRowComponents(this.getNavButtons());
		return page;
	}

	private getNavButtons() {
		const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>();
		const currentPage = this.currentPageI;
		const maxPage = this.maxPage;
		buttons.addComponents(
			new ButtonBuilder()
				.setCustomId(CustomIds.PageFirst)
				.setLabel('⏮')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage === 0),
			new ButtonBuilder()
				.setCustomId(CustomIds.PagePrevious)
				.setLabel('◀')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 0),
			new ButtonBuilder()
				.setCustomId(CustomIds.PageNext)
				.setLabel('▶')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === maxPage),
			new ButtonBuilder()
				.setCustomId(CustomIds.PageLast)
				.setLabel('⏭')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage === maxPage || maxPage === Infinity),
		);
		return buttons;
	}

	/**
	 * Creates a new pagination instance.
	 * @param itemsPerPage The number of items to show per page.
	 * @param totalItems The total number of items.
	 * @param createPage A function that creates a page given the page index and the number of items to show per page.
	 * @param startingPage The page index to start on.
	 * @param cachePages Whether to cache pages or not. Defaults to false.
	 */
	constructor({
		itemsPerPage,
		totalItems,
		createPage,
		startingPage = 0,
		cachePages = false,
	}: {
		itemsPerPage: number;
		totalItems?: number;
		createPage: CreatePageFunction;
		startingPage?: number;
		cachePages?: boolean;
	}) {
		this.itemsPerPage = itemsPerPage;
		this.totalItems = totalItems;
		this.currentPageI = startingPage;
		this.createPage = (index) => {
			return createPage(index, this.itemsPerPage);
		};
		this.cachePages = cachePages;
	}

	setTotalItems(totalItems?: number) {
		this.totalItems = totalItems;
	}

	/**
	 * Sets the page at the given index to the given page.
	 *
	 * @param index The index of the page to set.
	 * @param pageOverwrite The page to overwrite the page at the given index with.
	 * If not given, a new page will be created using the `createPage` function.
	 * @throws {Errors.NotAllowedError} If `cachePages` is false.
	 * @throws {Errors.OutOfBoundsError} If the given index is out of range.
	 */
	async set(index: number, pageOverwrite?: Page) {
		if (!this.cachePages) {
			throw new Errors.NotAllowedError('Cannot set page when cachePages is false');
		}
		if (index < 0 || index > this.maxPage) {
			throw new Errors.OutOfBoundsError(`Page index ${index} is out of range`);
		}
		this.pages.set(index, pageOverwrite ?? (await this.createPage(index)));
		if (index > this.highestPage) {
			this.highestPage = index;
		}
	}

	/**
	 * Appends a page to the end of the pages array.
	 *
	 * If `pageOverwrite` is given, it will be used as the new page. Otherwise, a new
	 * page will be created using the `createPage` function.
	 *
	 * @param pageOverwrite The page to append to the end of the pages array. If not
	 * given, a new page will be created.
	 */
	append(pageOverwrite?: Page) {
		this.set(this.highestPage + 1, pageOverwrite);
	}

	/**
	 * Sets the current page to the given index.
	 *
	 * @param index The index of the page to set as the current page.
	 * @throws {Errors.OutOfBoundsError} If the given index is out of range.
	 */
	setCurrentPage(index: number) {
		if (index < 0 || index > this.maxPage) {
			throw new Errors.OutOfBoundsError(`Page index ${index} is out of range`);
		}
		this.currentPageI = index;
		if (index > this.highestPage) {
			this.highestPage = index;
		}
	}

	/**
	 * Replies to the given interaction with the current page.
	 *
	 * A button collector is created with the following IDs:
	 * - `CustomIds.PageFirst`: sets the current page to the first page.
	 * - `CustomIds.PagePrevious`: sets the current page to the previous page.
	 * - `CustomIds.PageNext`: sets the current page to the next page.
	 * - `CustomIds.PageLast`: sets the current page to the last page.
	 *
	 * @param interaction The interaction to reply to.
	 * @param ephemeral Whether or not the response should be ephemeral. Defaults to true.
	 */
	async replyTo(interaction: RepliableInteraction, ephemeral = true) {
		const toReply = {
			components: [await this.getFormattedPage()],
			flags: (ephemeral ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
			withResponse: true,
			allowedMentions: {
				roles: [],
				users: [],
			},
		} as const;
		const resp =
			interaction.replied || interaction.deferred
				? await interaction.followUp(toReply)
				: (await interaction.reply(toReply)).resource?.message;
		if (!resp) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.NoResponse, ErrorReplies.ReportToOwner]),
				true,
			);
			return;
		}
		const collector = resp.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 3 * 60 * 1000,
			idle: 60 * 1000,
		});
		collector.on('end', async () => {
			collector.removeAllListeners();
			this.pages.clear();
		});
		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await reportErrorToUser(i, constructError([ErrorReplies.NotOwnerOfInteraction]), true);
				return;
			}
			switch (i.customId) {
				case CustomIds.PageFirst:
					this.setCurrentPage(0);
					break;
				case CustomIds.PagePrevious:
					this.setCurrentPage(this.currentPageI - 1);
					break;
				case CustomIds.PageNext:
					this.setCurrentPage(this.currentPageI + 1);
					break;
				case CustomIds.PageLast:
					this.setCurrentPage(this.maxPage);
					break;
				default:
					throw new Errors.ValueError(`Unknown customId: ${i.customId}`);
			}
			await i.update({ components: [await this.getFormattedPage()] });
		});
	}
}
//#endregion

//#region Generics

// Thanks ChatGPT
/**
 * Deeply transforms an object or array by applying a transformation function
 * to values that match a given predicate.
 *
 * @template T - Input type
 * @param value - The object, array, or primitive to transform
 * @param canTransform - Predicate function: decides if the value should be transformed
 * @param transform - Transformation function: maps the value to a new value
 * @returns A new deeply transformed object/array/primitive
 *
 * @example
 * const obj = { a: 1, b: { c: 2, d: [3, 4] } };
 * const result = deepTransform(
 *   obj,
 *   (val) => typeof val === "number",
 *   (val) => (val as number) * 10
 * );
 * // result: { a: 10, b: { c: 20, d: [30, 40] } }
 */
export function deepTransform<T>(
	value: T,
	canTransform: (val: unknown) => boolean,
	transform: (val: unknown) => unknown,
): unknown {
	if (canTransform(value)) {
		return transform(value) as T;
	}

	if (Array.isArray(value)) {
		return value.map((item) => deepTransform(item, canTransform, transform)) as unknown as T;
	}

	if (value !== null && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			result[key] = deepTransform(val, canTransform, transform);
		}
		return result as T;
	}

	return value;
}

export function wrapText<T extends string, W1 extends string, W2 extends string = W1>(
	text: T,
	wrapperLeft: W1,
	wrapperRight: W1 | W2 = wrapperLeft,
): `${W1}${T}${W2 | W1}` {
	return `${wrapperLeft}${text}${wrapperRight}`;
}

export function intDiv(a: number, b: number) {
	return (a / b) | 0;
}

export function caseToSpaced(s: string) {
	return s.replace(/([A-Z])/g, ' $1');
}

function capitalise<S extends string>(str: S): Capitalize<S> {
	return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<S>;
}

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

export function flattenVals<T extends Record<any, any>>(obj: T): RecursiveFlatVals<T>[] {
	const out = [];
	for (const [_, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			out.push(...flattenVals(val));
		} else {
			out.push(val);
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
 * Converts a duration string to a duration in milliseconds.
 *
 * The string should be in the format as specified by the `parse-duration` package.
 * If the string is invalid, the function returns `null`.
 *
 * @param str The duration string to parse.
 * @returns The duration in milliseconds, or `null` if the string is invalid.
 */
export function strToDuration(str: string) {
	const duration = parseDuration(str);
	return duration;
}

export function getValue<T>(obj: T, path: []): T | undefined;
export function getValue<T, K1 extends keyof T>(obj: T, path: [K1]): T[K1] | undefined;
export function getValue<T, K1 extends keyof T, K2 extends keyof T[K1]>(obj: T, path: [K1, K2]): T[K1][K2] | undefined;
export function getValue<T>(obj: T, path: (string | number)[]): unknown;
/**
 * Gets a value from an object by traversing the object using a path.
 *
 * The path is an array of strings or numbers that represent the path to the value.
 * The function starts from the given object and traverses the object by
 * following the path. If the path is invalid, the function returns `undefined`.
 *
 * @example
 * getValue({ a: { b: { c: 1 } } }, ['a', 'b', 'c']) // returns 1
 * getValue({ a: { b: { c: 1 } } }, ['a', 'b', 'd']) // returns undefined
 *
 * @param obj The object to traverse.
 * @param path The path to the value.
 * @returns The value at the given path, or `undefined` if the path is invalid.
 */
export function getValue<T>(obj: T, path: (string | number)[]): unknown {
	return path.reduce<any>((acc, key) => {
		if (acc && typeof acc === 'object' && key in acc) {
			return acc[key as keyof typeof acc];
		}
		return undefined;
	}, obj);
}

//#endregion

//#region Subcommands

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
	interaction: RepliableInteraction,
	error: string | InteractionReplyOptions | MessagePayload,
	ephemeral = true,
) {
	const toReply = (
		typeof error === 'string'
			? {
					embeds: [defaultEmbed().setTitle('Error').setDescription(error).setColor('Red')],
					flags: ephemeral ? MessageFlags.Ephemeral : undefined,
				}
			: error
	) satisfies InteractionReplyOptions | MessagePayload;
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(toReply);
	} else {
		await interaction.reply(toReply);
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

//#region Logging

export namespace Logging {
	export enum Type {
		Default,
		Warning,
		Error,
		Info,
	}
	interface ActionBlame {
		action?: string;
		cause?: string;
		userId?: string;
	}
	//export const Messages = {} as const satisfies { [name: string]: MessageCreateOptions | string };
	const formatters = {
		[Type.Default]: (data: { msg: string }) => ({ content: data.msg, allowedMentions: { users: [], roles: [] } }),
		[Type.Warning]: (data: ActionBlame & { msg: string }) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [
				defaultEmbed()
					.setTitle('⚠ Warning')
					.setDescription(data.msg)
					.setColor('Yellow')
					.addFields([
						{ name: 'Action', value: data.action ?? 'Unknown' },
						{ name: 'Cause', value: data.cause ?? 'Unknown' },
						{ name: 'User', value: data.userId ? userMention(data.userId) : 'Unknown' },
					]),
			],
		}),
		[Type.Error]: (data: ActionBlame & { msg: string }) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [
				defaultEmbed()
					.setTitle('❌ Error')
					.setDescription(data.msg)
					.setColor('Red')
					.addFields([
						{ name: 'Action', value: data.action ?? 'Unknown' },
						{ name: 'Cause', value: data.cause ?? 'Unknown' },
						{ name: 'User', value: data.userId ? userMention(data.userId) : 'Unknown' },
					]),
			],
		}),
		[Type.Info]: (msg: string) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [defaultEmbed().setTitle(':information_source: Info').setDescription(msg).setColor('Blue')],
		}),
	} as const satisfies {
		[t in Type]: (data: any) => MessageCreateOptions | string;
	};

	export const Extents = {
		[GuildFlag.LogAll]: 0b1111,
		[GuildFlag.LogErrors]: 0b1,
		[GuildFlag.LogWarnings]: 0b10,
		[GuildFlag.LogInfo]: 0b100,
		[GuildFlag.LogDebug]: 0b1000,
	} as const satisfies { [K in GuildFlag]?: number };
	export type LogExtent = keyof typeof Extents;
	export function hasExtents(flags: GuildFlagField, ...extents: LogExtent[]) {
		const exts = extents.reduce((acc, extent) => acc | Extents[extent], 0);
		return (
			((Object.keys(Extents) as GuildFlag[])
				.filter((a) => flags & GuildFlagBits[a])
				.reduce((a, b) => a | (Extents[b as LogExtent] ?? 0), 0) &
				exts) ===
			exts
		);
	}

	export const logChannelCache = new Map<string, ForumChannel>();
	export const logExtentsCache = new Map<string, number>();

	function getFormattedDate(date: Date) {
		const day = date.getDate();
		const month = date.getMonth() + 1;
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}
	/**
	 * Gets a thread from the given log channel at the given date.
	 * If the thread does not exist and create is true, a new thread will be created.
	 * If the thread does not exist and create is false, undefined will be returned.
	 * @param logChannel The log channel to get the thread from.
	 * @param t The date to get the thread from.
	 * @param create Whether to create a new thread if the thread does not exist.
	 * @returns The thread at the given date if it exists, or undefined if it does not exist and create is false.
	 * If create is true, the returned thread will be the newly created thread.
	 */
	export async function getThreadAtDay<T extends boolean = false>(
		logChannel: ForumChannel,
		t: Date,
		create: T,
	): Promise<T extends true ? ForumThreadChannel : ForumThreadChannel | undefined> {
		const date = getFormattedDate(t);
		return (logChannel.threads.cache.find((thread) => thread.name === date) ??
			(create
				? await logChannel.threads.create({
						name: getFormattedDate(t),
						autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
						message: { content: 'Logs for ' + time(t, TimestampStyles.LongDate) },
					})
				: undefined)) as T extends true ? ForumThreadChannel : ForumThreadChannel | undefined;
	}
	/**
	 * Gets the current day's log thread from the given log channel.
	 *
	 * If the thread does not exist, it will be created.
	 *
	 * @param logChannel The forum channel to get the thread from.
	 * @returns The current day's log thread.
	 */
	export function getTodayThread(logChannel: ForumChannel) {
		return getThreadAtDay(logChannel, new Date(), true);
	}
	/**
	 * Logs a message to the appropriate log channel for the given guild.
	 *
	 * @param data The interaction or guild data to get the log channel from.
	 * @param logType The type of log message to send.
	 * @param message The message to be logged.
	 * @param extents The log extents to check for before logging.
	 *
	 * @returns A Promise that resolves when the message has been logged.
	 */
	export async function log<T extends Type>({
		data,
		logType,
		formatData,
		extents,
	}: {
		data: Interaction | { guildId: string };
		logType: T;
		formatData: Parameters<(typeof formatters)[T]>[0];
		extents: LogExtent[];
	}) {
		let { guildId } = data;
		if (!guildId) return;
		const exts = extents.reduce((acc, extent) => acc | Extents[extent], 0);
		let logChannel = logChannelCache.get(guildId);
		let logExtents = logExtentsCache.get(guildId);
		if (!logChannel) {
			const guild = await Data.models.Guild.findOne({ where: { guildId } });
			if (!guild) return;
			if (!guild.logChannelId) return;
			logChannel = (await client.channels.fetch(guild.logChannelId)) as ForumChannel;
			logChannelCache.set(guildId, logChannel);
		}
		if (!logExtents) {
			const guild = await Data.models.Guild.findOne({ where: { guildId } });
			if (!guild) return;
			const guildFlags = guild.guildFlags;
			logExtents = (Object.keys(Extents) as GuildFlag[])
				.filter((flag) => guildFlags & GuildFlagBits[flag])
				.reduce((acc, flag) => acc | Extents[flag], 0);
			if (logExtents === 0) return;
			logExtentsCache.set(guildId, logExtents);
		}
		if ((logExtents & exts) !== exts) return;
		if (!logChannel) return;
		const todayThread = await getTodayThread(logChannel);
		const formatted = formatters[logType](formatData as any);
		await todayThread.send(formatted);
	}
}

//#endregion
