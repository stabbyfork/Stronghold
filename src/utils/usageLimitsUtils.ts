//#region Usage

import { ChatInputCommandInteraction, User } from 'discord.js';
import ms from 'ms';
import { Errors } from '../types/errors.js';

export enum UsageScope {
	Global,
	GuildAll,
	GuildMember,
	User,
}
export enum UsageEnum {
	DMSend,
	CommandExecute,
	APIRequest,
}

export interface UsageLimitParams {
	usesPerInterval: number;
	useCooldown: number;
	intervalMs: number;
	scope?: UsageScope;
}
type UsageType = UsageEnum | string;
export class UsageLimit {
	/**
	 * Constructs a new UsageLimit object.
	 * @param options.usesPerInterval The maximum number of uses within the interval.
	 * @param options.useCooldown The cooldown time between uses.
	 * @param options.intervalMs The time interval in milliseconds.
	 * @param options.scope The scope of the usage limit. Defaults to {@link UsageScope.GuildMember}.
	 */
	constructor({ usesPerInterval, useCooldown, intervalMs, scope = UsageScope.GuildMember }: UsageLimitParams) {
		this.useCooldown = useCooldown;
		this.usesPerInterval = usesPerInterval;
		this.renewInterval = intervalMs;
		this.scope = scope;
		this._nextPossibleUse = 0;
		this._lastUsed = 0;
		this._usesLeft = usesPerInterval;
	}
	readonly scope: UsageScope;
	private _nextPossibleUse: number;
	get nextPossibleUse() {
		return this._nextPossibleUse;
	}
	private set nextPossibleUse(nextPossibleUse) {
		//this.rawData.setUint32(UsageBufferOffsets.NextPossibleUse, nextPossibleUse);
		this._nextPossibleUse = nextPossibleUse;
	}
	private _lastUsed: number;
	get lastUsed() {
		//return this.rawData.getUint32(UsageBufferOffsets.LastUsed);
		return this._lastUsed;
	}
	private set lastUsed(lastUsed) {
		//this.rawData.setUint32(UsageBufferOffsets.LastUsed, lastUsed);
		this._lastUsed = lastUsed;
	}
	private _usesLeft: number;
	get usesLeft() {
		//return this.rawData.getUint8(UsageBufferOffsets.UsesLeft);
		return this._usesLeft;
	}
	private set usesLeft(usesLeft) {
		//this.rawData.setUint8(UsageBufferOffsets.UsesLeft, usesLeft);
		this._usesLeft = usesLeft;
	}
	usesPerInterval: number;
	useCooldown: number;
	renewInterval: number;
	/**
	 * Returns the time until the next possible use of the usage limit.
	 * @param long Whether to return the result using long words. Defaults to true
	 * @returns The time until the next possible use of the usage limit.
	 */
	timeUntilNextUse(long: boolean = true) {
		return ms(this.nextPossibleUse - Date.now(), { long: long });
	}
	/**
	 * Attempts to use the usage limit.
	 *
	 * If the usage limit can be used at the given time, decrements the uses left and updates the last used and next possible use times.
	 * If the usage limit cannot be used at the given time, returns false.
	 *
	 * @param atMs The time at which to check if the usage limit can be used. Defaults to the current time.
	 * @returns Whether the usage limit was used.
	 */
	use(atMs: number = Date.now()): boolean {
		if (!this.canUse(atMs)) return false;
		if (this.lastUsed + this.renewInterval <= atMs) this.usesLeft = this.usesPerInterval;
		this.lastUsed = atMs;
		this.usesLeft = this.usesLeft - 1;
		this.nextPossibleUse = atMs + this.useCooldown + (this.usesLeft > 0 ? 0 : (this.renewInterval ?? 0));
		if (this.usesLeft <= 0) this.usesLeft = this.usesPerInterval;
		return true;
	}
	/**
	 * Whether the action can be used at the given time (in milliseconds).
	 *
	 * @param atMs The time in milliseconds to check for availability. Defaults to the current time.
	 * @returns Whether the action can be used at the given time.
	 */
	canUse(atMs: number = Date.now()): boolean {
		return (this.lastUsed + this.renewInterval <= atMs || this.usesLeft > 0) && this.nextPossibleUse <= atMs;
	}
	/**
	 * Creates a new UsageLimit with the same properties as the current one.
	 * Resets the next possible use, last used time, and available uses.
	 * @returns A new UsageLimit.
	 */
	clone() {
		return new UsageLimit({
			usesPerInterval: this.usesPerInterval,
			useCooldown: this.useCooldown,
			intervalMs: this.renewInterval,
			scope: this.scope,
		});
	}
	/**
	 * Resets the usage limit to its available state.
	 * Sets the available uses to the maximum uses per interval, resets the last used time to 0, and sets the next possible use time to the current time.
	 */
	setAvailable() {
		this.usesLeft = this.usesPerInterval;
		this.lastUsed = 0;
		this.nextPossibleUse = Date.now();
	}
	/**
	 * Adds the given number of uses to the available uses.
	 * If allowUse is true, sets the next possible use to the current time.
	 * @param uses The number of uses to add.
	 * @param allowUse Whether to allow the added uses to be used immediately.
	 */
	addUses(uses: number, allowUse = true) {
		this.usesLeft = Math.max(Math.min(this.usesLeft + uses, this.usesPerInterval), 0);
		if (allowUse) {
			this.nextPossibleUse = Date.now();
		}
	}
	/**
	 * Adds one use to the available uses.
	 * If allowUse is true, sets the next possible use to the current time.
	 * @param allowUse Whether to allow the added uses to be used immediately. Defaults to true.
	 */
	addUse(allowUse = true) {
		this.addUses(1, allowUse);
	}
}
export const UsageDefaults = {
	[UsageEnum.DMSend]: new UsageLimit({ usesPerInterval: 2, useCooldown: 10, intervalMs: 60 * 60 * 2 * 1000 }),
	[UsageEnum.CommandExecute]: new UsageLimit({ usesPerInterval: 15, useCooldown: 2 * 1000, intervalMs: 60 * 1000 }),
	[UsageEnum.APIRequest]: new UsageLimit({ usesPerInterval: 20, useCooldown: 0, intervalMs: 60 * 1000 }),
} as const satisfies { [T in UsageType]: UsageLimit };

class UsageMap extends Map<UsageType, UsageLimit> {
	constructor() {
		super();
	}
	/**
	 * Returns a the UsageLimit at the given key.
	 * If the key does not exist, and a defaultValue is provided, sets the key to the defaultValue and returns the clone.
	 * @param key The key to retrieve the UsageLimit at.
	 * @param defaultValue The default value to set the key to if the key does not exist.
	 * @returns The UsageLimit at the given key or cloned `defaultValue`.
	 */
	getSetClone<D extends UsageLimit | undefined>(key: UsageType, defaultValue?: D): D {
		return (defaultValue ? (this.get(key) ?? this.set(key, defaultValue.clone()).get(key)) : this.get(key)) as D;
	}
}

export namespace Usages {
	const usages: {
		guild: {
			[guildId: string]: {
				user: {
					[userId: string]: UsageMap;
				};
				all: UsageMap;
			};
		};
		user: {
			[userId: string]: UsageMap;
		};
		global: UsageMap;
	} = {
		guild: {},
		user: {},
		global: new UsageMap(),
	};
	function createGuild(guildId: string) {
		if (usages.guild[guildId]) return;
		usages.guild[guildId] = {
			user: {},
			all: new UsageMap(),
		};
	}
	function createUser(userId: string) {
		if (usages.user[userId]) return;
		usages.user[userId] = new UsageMap();
	}
	function createGuildMember(guildId: string, userId: string) {
		createGuild(guildId);
		if (usages.guild[guildId].user[userId]) return;
		usages.guild[guildId].user[userId] = new UsageMap();
	}

	export function guild(guildId: string): (typeof usages.guild)[string] {
		createGuild(guildId);
		return usages.guild[guildId];
	}
	export function user(userId: string): UsageMap {
		createUser(userId);
		return usages.user[userId];
	}
	export function global() {
		return usages.global;
	}
	export function guildMember(guildId: string, userId: string) {
		createGuildMember(guildId, userId);
		return guild(guildId).user[userId];
	}
	export function guildAll(guildId: string) {
		createGuild(guildId);
		return guild(guildId).all;
	}

	/**
	 * Returns the UsageMap corresponding associated with the given scope and data.
	 * @param scope The scope of the usage limit.
	 * @param data The data to use to retrieve the UsageMap. If an object, the properties are:
	 *   - `guildId`: The ID of the guild to retrieve the UsageMap for.
	 *   - `user`: The ID of the user to retrieve the UsageMap for.
	 *   If an interaction, the guild and user properties are inferred from it.
	 * @returns The UsageMap associated with the given scope and data.
	 * @example
	 * byScope(UsageScope.GuildMember, { guildId: '123456789012345678', user: '123456789012345678' });
	 * byScope(UsageScope.GuildAll, { guildId: '123456789012345678' });
	 * byScope(UsageScope.User, { user: '123456789012345678' });
	 * byScope(UsageScope.Global);
	 */
	export function byScope(interaction: ChatInputCommandInteraction): UsageMap;
	export function byScope<T extends UsageScope>(
		scope: T,
		data: { guildId?: string; user?: string } | ChatInputCommandInteraction,
	): UsageMap;
	export function byScope<T extends UsageScope.Global>(scope: T): UsageMap;
	export function byScope<T extends UsageScope.GuildAll>(
		scope: T,
		data: { guildId: string } | ChatInputCommandInteraction,
	): UsageMap;
	export function byScope<T extends UsageScope.GuildMember>(
		scope: T,
		data: { guildId: string; user: string } | ChatInputCommandInteraction,
	): UsageMap;
	export function byScope<T extends UsageScope.User>(
		scope: T,
		data: { user: string } | ChatInputCommandInteraction,
	): UsageMap;
	export function byScope(
		scope: ChatInputCommandInteraction | UsageScope,
		data: { guildId?: string; user?: string } | ChatInputCommandInteraction = {},
	) {
		let { guildId, user: queryUser } = data;
		if (queryUser instanceof User) queryUser = queryUser.id;
		if (scope instanceof ChatInputCommandInteraction) {
			if (scope.guildId) {
				return guildMember(scope.guildId, scope.user.id);
			} else {
				return user(scope.user.id);
			}
		}
		switch (scope) {
			case UsageScope.GuildAll:
				if (!guildId) throw new Errors.ValueError('Guild ID is required');
				return guildAll(guildId);
			case UsageScope.User:
				if (!guildId) throw new Errors.ValueError('User ID is required');
				return user(guildId);
			case UsageScope.GuildMember:
				if (!guildId) throw new Errors.ValueError('Guild ID is required');
				if (!queryUser) throw new Errors.ValueError('User ID is required');
				return guildMember(guildId, queryUser);
			case UsageScope.Global:
				return global();
			default:
				throw new Errors.ValueError('Invalid usage scope');
		}
	}
	/**
	 * Checks if multiple usages are ready in a given context.
	 * @param keys The usage types to check.
	 * @param details The context to check in. If an object, the properties are:
	 *   - `guildId`: The guild ID to check in. If not present, guild usages are not checked.
	 *   - `user`: The user ID or object to check in. If not present, user usages are not checked.
	 *   If an interaction, the guild and user properties are inferred from it.
	 * @returns `[true]` if all usages are ready, or `[false, limit]` if any usage is not ready, where `limit` is the UsageLimit that is not ready.
	 */
	export function isReadyMany(
		keys: UsageType[],
		details: { guildId?: string; user?: string } | ChatInputCommandInteraction,
	): [true] | [false, UsageLimit] {
		const { guildId, user: queryUser } = details;
		const userId = typeof queryUser === 'string' ? queryUser : queryUser?.id;
		for (const key of keys) {
			const globalLimit = usages.global.get(key);
			if (globalLimit && !globalLimit.canUse()) return [false, globalLimit];

			const guildLimit = guildId ? guild(guildId)?.all.get(key) : undefined;
			if (guildLimit && !guildLimit.canUse()) return [false, guildLimit];

			const userLimit = userId ? user(userId)?.get(key) : undefined;
			if (userLimit && !userLimit.canUse()) return [false, userLimit];

			const guildMemberLimit = guildId && userId ? guildMember(guildId, userId)?.get(key) : undefined;
			if (guildMemberLimit && !guildMemberLimit.canUse()) return [false, guildMemberLimit];
			return [true];
		}
		return [true];
	}
	/**
	 * Checks if a usage is ready in all applicable maps.
	 * @param key The usage type.
	 * @param details The details object or interaction to check guild and guild member limits.
	 * @returns A boolean indicating whether the usage is ready.
	 */
	export function isReady(
		key: UsageType,
		details: { guildId?: string; userId?: string } | ChatInputCommandInteraction,
	) {
		return isReadyMany([key], details);
	}
}
//#endregion
