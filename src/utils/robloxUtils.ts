import axios from 'axios';
import urlBuilder from 'build-url-ts';
import fuzzysort from 'fuzzysort';
import _ from 'lodash';
import { Config } from '../config.js';
import { Debug } from './errorsUtils.js';
import { delayFor, MapQueue, Pair } from './genericsUtils.js';
import { APIGuildMember, Interaction, userMention } from 'discord.js';
import path from 'path';
import { Logging } from './loggingUtils.js';
import { GuildFlag } from './guildFlagsUtils.js';
const { buildUrl } = urlBuilder;

export interface UsernameToUserData {
	requestedUsername: string;
	hasVerifiedBadge: boolean;
	id: number;
	name: string;
	displayName: string;
}

interface IdToUserData {
	hasVerifiedBadge: boolean;
	id: number;
	name: string;
	displayName: string;
}

type AssetState = 'Error' | 'Completed' | 'InReview' | 'Pending' | 'Blocked' | 'TemporarilyUnavailable';

interface IdToAvatarBust {
	targetId: number;
	state: AssetState;
	imageUrl: string;
	version: string;
}

// Discord connection
interface DiscordToRobloxData {
	robloxId: number;
	cachedUsername: string;
	discordId: string;
	guildId: string;
}

interface RobloxToDiscordData {
	robloxId: number;
	guildId: string;
	discordUsers: APIGuildMember[];
}

type RobloxUsername = string;
type RobloxUserId = number;
type DiscordUserId = string;

const roverConfig = Config.get('roblox')?.rover;
const CHUNK_SIZE = 100 as const; // Number of users to fetch from Roblox API at once when doing bulk fetches
const RETRY_MAX = 5 as const; // Maximum number of retries for RoVer API requests when rate limited
const RETRY_BASE_DELAY = 500 as const; // Base delay time in ms for retries when RoVer API rate limited, multiplied by 2^retryNum for exponential backoff

export namespace RbxCaches {
	/** Uses requested usernames as keys */
	export const usernamesToData: Map<RobloxUsername, UsernameToUserData> = new Map();
	export const idsToData: Map<RobloxUserId, IdToUserData> = new Map();
	export const idsToAvatarBusts: Map<RobloxUserId, IdToAvatarBust> = new Map();
	export const preparedUsernames: Fuzzysort.Prepared[] = [];

	/** Discord user ID -> Roblox user data (from Rover) */
	export const discordToRobloxData: Map<DiscordUserId, DiscordToRobloxData> = new Map();
	/** Roblox user ID -> Discord user data (from Rover) */
	export const robloxToDiscordData: Map<RobloxUserId, RobloxToDiscordData> = new Map();
}

export namespace RbxUtils {
	/**
	 * Convert a list of usernames to their corresponding corresponding data.
	 * @param usernames The usernames to convert.
	 * @returns A promise that resolves to an array of {@link UsernameToUserData} objects.
	 * @throws Nothing
	 */
	export async function usernamesToData(...usernames: RobloxUsername[]) {
		if (usernames.length === 0) return [];
		const existing = [] as UsernameToUserData[];
		const nonExistingUsernames = [] as RobloxUsername[];
		usernames.forEach((username) => {
			if (RbxCaches.usernamesToData.has(username)) existing.push(RbxCaches.usernamesToData.get(username)!);
			else {
				nonExistingUsernames.push(username);
			}
		});
		if (existing.length === usernames.length) return existing;
		for (const chunk of _.chunk(nonExistingUsernames, CHUNK_SIZE)) {
			// Process in chunks of 100 to avoid hitting length limits of the Roblox API
			await axios
				.post(
					'https://users.roblox.com/v1/usernames/users',
					{
						usernames: chunk,
						excludeBannedUsers: true,
					},
					{
						timeout: 15000,
						timeoutErrorMessage:
							'Roblox API did not respond within 15 seconds. Perhaps a username is taking too long to resolve?',
					},
				)
				.catch((err) =>
					Debug.error(
						`Failed to convert usernames to data: ${err}. This may be caused by too many usernames being requested at once or the Roblox API being slow to respond.`,
					),
				)
				.then((res) => {
					if (!res) return existing;
					existing.push(...(res.data.data as UsernameToUserData[]));
					(res.data.data as UsernameToUserData[]).forEach((user) => {
						RbxCaches.usernamesToData.set(user.requestedUsername, user);
						RbxCaches.preparedUsernames.push(fuzzysort.prepare(user.name));
					});
				});
		}
		return existing;
	}

	/**
	 * Convert a username to its corresponding data.
	 * @param username The username to convert.
	 * @returns A promise that resolves to a {@link UsernameToUserData} object.
	 * @throws Nothing
	 */
	export async function usernameToData(username: RobloxUsername) {
		return usernamesToData(username).then((data) => data[0]);
	}

	/**
	 * Convert a list of IDs to their corresponding data.
	 * @param ids The IDs to convert.
	 * @returns A promise that resolves to an array of objects containing the requested user's data.
	 * @throws Nothing
	 */
	export async function idsToData(...ids: RobloxUserId[]) {
		if (ids.length === 0) return [];
		const existing = [] as IdToUserData[];
		const nonExistingIds = [] as RobloxUserId[];
		ids.forEach((id) => {
			if (RbxCaches.idsToData.has(id)) existing.push(RbxCaches.idsToData.get(id)!);
			else {
				nonExistingIds.push(id);
			}
		});
		if (existing.length === ids.length) return existing;
		for (const chunk of _.chunk(nonExistingIds, CHUNK_SIZE)) {
			// Process in chunks of CHUNK_SIZE to avoid hitting length limits of the Roblox API
			await axios
				.post(
					'https://users.roblox.com/v1/users',
					{
						userIds: chunk,
					},
					{
						timeout: 15000,
						timeoutErrorMessage:
							'Roblox API did not respond within 15 seconds. Perhaps the server is busy?',
					},
				)
				.catch((err) =>
					Debug.error(
						`Failed to convert ids to data: ${err}. This may be caused by too many IDs being requested at once or the Roblox API being slow to respond.`,
					),
				)
				.then((res) => {
					if (!res) return existing;
					existing.push(...(res.data.data as IdToUserData[]));
					(res.data.data as IdToUserData[]).forEach((user) => RbxCaches.idsToData.set(user.id, user));
				});
		}

		return existing;
	}

	/**
	 * Convert a list of usernames to their corresponding IDs.
	 * @param usernames The usernames to convert.
	 * @returns A promise that resolves to a map where the keys are the usernames and the values are the IDs.
	 * @throws Nothing
	 */
	export async function usernamesToIds(...usernames: RobloxUsername[]) {
		return usernamesToData(...usernames).then((data) => {
			const returnMap = new Map<RobloxUsername, RobloxUserId>();
			data.forEach((d) => returnMap.set(d.name, d.id));
			return returnMap;
		});
	}

	/**
	 * Convert a username to their corresponding ID.
	 * @param username The username to convert.
	 * @returns A promise that resolves to the ID of the user, or undefined if the user does not exist.
	 * @throws Nothing
	 */
	export async function usernameToId(username: RobloxUsername) {
		return usernamesToData(username).then((data) => data[0]?.id as RobloxUserId | undefined);
	}

	/**
	 * Convert a list of IDs to their corresponding avatar busts.
	 * @param ids The IDs to convert.
	 * @returns A promise that resolves to an array of {@link IdToAvatarBust} objects.
	 * @throws Nothing
	 */
	export async function idsToAvatarBusts(...ids: RobloxUserId[]) {
		if (ids.length === 0) return [];
		const existing = [] as IdToAvatarBust[];
		const nonExistingIds = [] as RobloxUserId[];
		ids.forEach((id) => {
			if (RbxCaches.idsToAvatarBusts.has(id)) {
				existing.push(RbxCaches.idsToAvatarBusts.get(id)!);
			} else {
				nonExistingIds.push(id);
			}
		});

		if (existing.length === ids.length) return existing;
		for (const chunk of _.chunk(nonExistingIds, CHUNK_SIZE)) {
			// Process in chunks of CHUNK_SIZE to avoid hitting length limits of the Roblox API
			await axios
				.get(
					buildUrl('https://thumbnails.roblox.com/v1/users/avatar-bust', {
						queryParams: {
							userIds: chunk,
							size: '150x150',
							format: 'Png',
							isCircular: false,
						},
					}),
				)
				.catch((err) => Debug.error(`Failed to convert ids to avatar busts: ${err}`))
				.then((res) => {
					if (!res) return existing;
					existing.push(...(res.data.data as IdToAvatarBust[]));
					(res.data.data as IdToAvatarBust[]).forEach((avtr) =>
						RbxCaches.idsToAvatarBusts.set(avtr.targetId, avtr),
					);
				});
		}
		return existing;
	}

	/**
	 * Convert an ID to its corresponding avatar bust.
	 * @param id The ID to convert.
	 * @returns A promise that resolves to a {@link IdToAvatarBust} object.
	 * @throws Nothing
	 */
	export async function idToAvatarBust(id: number) {
		return idsToAvatarBusts(id).then((data) => data[0]);
	}

	// Discord connection

	export let roverLock = false;
	let roverUnlockTimer: NodeJS.Timeout | null = null;

	/** Discord user ID -> list of [pending resolver, pending rejector, retry count, guild ID] */
	export const _dUserRequestQueue = new MapQueue<
		DiscordUserId,
		[(resolveWith: DiscordToRobloxData) => void, (rejectWith: Error) => void, number, string]
	>();

	/** Roblox user ID -> list of [pending resolver, pending rejector, retry count, guild ID] */
	export const _rUserRequestQueue = new MapQueue<
		RobloxUserId,
		[(resolveWith: RobloxToDiscordData) => void, (rejectWith: Error) => void, number, string]
	>();

	export let _previousDKeySize = 0;
	export let _previousRKeySize = 0;
	export let _dKeysAddedSinceLastRun = 0;
	export let _rKeysAddedSinceLastRun = 0;

	function setRoverUnlock(newId: NodeJS.Timeout, override: boolean) {
		if (roverUnlockTimer && !override) {
			Debug.error(
				`Attempted to set a new RoVer unlock timer while one is already active, but override is false. New timer ID: ${newId}, existing timer ID: ${roverUnlockTimer}`,
			);
			return;
		}
		if (roverUnlockTimer) {
			clearTimeout(roverUnlockTimer);
		}
		roverUnlockTimer = newId;
	}

	/**
	 * Lock the RoVer API connection, preventing any requests from being made, for the duration.
	 * This is used when the API is rate limited to prevent further requests until the lock is lifted.
	 * @param delayTime Time to keep locked in seconds
	 */
	function lockRover(delayTime: number) {
		roverLock = true;
		Debug.error(`RoVer API has been locked for ${delayTime} seconds due to rate limiting.`);
		setRoverUnlock(
			setTimeout(
				() => {
					roverLock = false;
					roverUnlockTimer = null;
					Debug.error(`RoVer API lock has been lifted after ${delayTime + 0.5} seconds.`);
				},
				delayTime * 1000 + 500,
			),
			true,
		);
	}

	export async function _processDiscordToRobloxRequest(
		guildId: string,
		discordId: string,
		requestResolve: (resolveWith: DiscordToRobloxData) => void,
		requestReject: (rejectWith: Error) => void,
		retryNum: number,
	) {
		if (roverLock) {
			if (retryNum > RETRY_MAX) {
				Debug.error(
					`Exceeded maximum retry attempts for RoVer API. Aborting fetch Discord -> Roblox. (guild ID: ${guildId}, retry number: ${retryNum})`,
				);
				throw new Error('Exceeded maximum retry attempts for the RoVer API, it may be unavailable.');
			}
			const waitTime = RETRY_BASE_DELAY * 2 ** retryNum;
			Debug.error(
				`RoVer API is currently rate limited. Waiting ${waitTime}ms before retrying fetch Discord -> Roblox... (guild ID: ${guildId}, retry number: ${retryNum})`,
			);
			await delayFor(waitTime); // Exponential backoff
			_dUserRequestQueue.push(discordId, [requestResolve, requestReject, retryNum + 1, guildId]);
		}
		const result: Promise<DiscordToRobloxData | null> = axios
			.get(path.posix.join(roverConfig!.baseApiUrl, `/guilds/${guildId}/discord-to-roblox/${discordId}`), {
				headers: { Authorization: `Bearer ${roverConfig!.token}` },
				timeout: 10000,
				timeoutErrorMessage: 'Request to RoVer API timed out after 10 seconds',
			})
			.then(
				async (res) => {
					RbxCaches.discordToRobloxData.set(res.data.discordId, res.data);
					return res.data as DiscordToRobloxData;
				},
				async (err) => {
					if (!axios.isAxiosError(err)) {
						Debug.error(
							`Unexpected error type when fetching Discord to Roblox data for ID ${discordId} in guild ${guildId}: ${err}`,
						);
						throw err;
					}
					const res = err.response;
					// Big scary rate limiter
					if (res?.status === 429) {
						const res = err.response;
						const delayTime = Number(res!.headers['retry-after']);
						if (isNaN(delayTime)) {
							Debug.error(`Invalid retry-after header value: ${res!.headers['retry-after']}`);
							lockRover(60); // Lock for 1 minute as a fallback
							throw new Error('RoVer API rate limited but retry-after header is invalid');
						}
						roverLock = true;
						if (delayTime >= 5 * 60) {
							lockRover(delayTime);
							throw new Error(
								`RoVer API rate limited with retry-after of over 5 minutes. The API may be overloaded. Retry after ${delayTime} seconds.`,
							);
						}
						lockRover(delayTime);
						await delayFor(delayTime * 1000 + 500); // Add extra 0.5s for safety
						return discordToRobloxData(guildId, [discordId]).then((data) => data[0]); // Retry the failed ID
					} else if (res?.status === 404) {
						throw new Error(
							`Discord user ${userMention(discordId)} (id: \`${discordId}\`) not found in the RoVer database for this server. Is the user verified with RoVer? They can verify here: https://rover.link\n-# They may also need to use RoVer's /privacy to allow third-party access.`,
						);
					} else if (res?.status === 403) {
						Debug.error(
							`Access forbidden when fetching Discord to Roblox data for ID ${discordId} in guild ${guildId}.`,
						);
						throw new Error(
							'Access forbidden when fetching from RoVer API. Is the RoVer bot installed in this guild? Install it here: https://rover.link',
						);
					} else {
						Debug.error(
							`Failed to fetch Roblox data for Discord user ${discordId}: ${err.message} in guild ${guildId}, error code: ${res?.data.errorCode}, status: ${res?.status}, message: ${res?.data.message}`,
						);
						throw err;
					}
				},
			);

		return result.then((res) => {
			if (!res) return null;
			requestResolve(res);
			return res;
		});
	}

	export async function _processRobloxToDiscordRequest(
		guildId: string,
		robloxId: number,
		requestResolve: (resolveWith: RobloxToDiscordData) => void,
		requestReject: (rejectWith: Error) => void,
		retryNum: number,
	) {
		if (roverLock) {
			if (retryNum > RETRY_MAX) {
				Debug.error(
					`Exceeded maximum retry attempts for RoVer API. Aborting fetch Roblox -> Discord. (guild ID: ${guildId}, retry number: ${retryNum})`,
				);
				throw new Error('Exceeded maximum retry attempts for the RoVer API, it may be unavailable.');
			}
			const waitTime = RETRY_BASE_DELAY * 2 ** retryNum;
			Debug.error(
				`RoVer API is currently rate limited. Waiting ${waitTime}ms before retrying fetch Roblox -> Discord... (guild ID: ${guildId}, retry number: ${retryNum})`,
			);
			await delayFor(waitTime); // Exponential backoff
			_rUserRequestQueue.push(robloxId, [requestResolve, requestReject, retryNum + 1, guildId]);
		}
		const result: Promise<RobloxToDiscordData | null> = axios
			.get(path.posix.join(roverConfig!.baseApiUrl, `/guilds/${guildId}/roblox-to-discord/${robloxId}`), {
				headers: { Authorization: `Bearer ${roverConfig!.token}` },
				timeout: 10000,
				timeoutErrorMessage: 'Request to RoVer API timed out after 10 seconds',
			})
			.then(
				async (res: { data: RobloxToDiscordData }) => {
					RbxCaches.robloxToDiscordData.set(res.data.robloxId, res.data);
					return res.data as RobloxToDiscordData;
				},
				async (err) => {
					if (!axios.isAxiosError(err)) {
						Debug.error(
							`Unexpected error type when fetching Roblox to Discord data for ID ${robloxId} in guild ${guildId}: ${err}`,
						);
						throw err;
					}
					const res = err.response;
					// Big scary rate limiter
					if (res?.status === 429) {
						const res = err.response;
						const delayTime = Number(res!.headers['retry-after']);
						if (isNaN(delayTime)) {
							Debug.error(
								`Invalid retry-after header value: ${res!.headers['retry-after']}, locking RoVer indefinitely`,
							);
							roverLock = true; // Lock indefinitely until manually unlocked, since we don't know how long to lock for
							throw new Error('RoVer API rate limited but retry-after header is invalid');
						}
						if (delayTime >= 5 * 60) {
							lockRover(delayTime);
							throw new Error(
								`RoVer API rate limited with retry-after of over 5 minutes. The API may be overloaded. Retry after ${delayTime} seconds.`,
							);
						}
						lockRover(delayTime);
						await delayFor(delayTime * 1000 + 500); // Add extra 0.5s for safety
						return robloxToDiscordData(guildId, [robloxId]).then((data) => data[0]); // Retry the failed ID
					} else if (res?.status === 404) {
						throw new Error(
							`Roblox user ${robloxId} not found in the RoVer database for this server. Is the user verified with RoVer? They can verify here: https://rover.link\n-# They may also need to use RoVer's /privacy to allow third-party access.`,
						);
					} else if (res?.status === 403) {
						Debug.error(
							`Access forbidden when fetching Roblox to Discord data for ID ${robloxId} in guild ${guildId}.`,
						);
						throw new Error(
							'Access forbidden when fetching from RoVer API. Is the RoVer bot installed in this guild? Install it here: https://rover.link',
						);
					} else {
						Debug.error(
							`Failed to fetch Roblox data for Discord user ${robloxId}: ${err.message} in guild ${guildId}, error code: ${res?.data.errorCode}, status: ${res?.status}, message: ${res?.data.message}`,
						);
						throw err;
					}
				},
			);

		return result.then((res) => {
			if (!res) return null;
			requestResolve(res);
			return res;
		});
	}

	/**
	 * Fetches Discord to Roblox data for multiple Discord users from the Rover API.
	 * Results are cached.
	 *
	 * @param guildId - The Discord guild ID to query data for
	 * @param discordIds - Array of Discord user IDs to fetch Roblox data for
	 * @param interaction - Optional logging context (overrides guildId if provided)
	 * @returns Promise resolving to an array of {@link DiscordToRobloxData} objects containing the mapped user data
	 *
	 * @throws Will recursively retry if rate limited, throws error if Retry-After header is invalid
	 */
	export async function discordToRobloxData(guildId: string, discordIds: DiscordUserId[]) {
		if (!roverConfig) {
			Debug.error('RoVer config not found. Cannot fetch Discord to Roblox data.');
			throw new Error('RoVer config not found. Cannot fetch Discord to Roblox data.');
		}
		if (discordIds.length === 0) return [];
		const existing = [] as DiscordToRobloxData[];
		const nonExistingDiscordIds = [] as DiscordUserId[];
		discordIds.forEach((id) => {
			if (RbxCaches.discordToRobloxData.has(id)) existing.push(RbxCaches.discordToRobloxData.get(id)!);
			else nonExistingDiscordIds.push(id);
		});
		if (existing.length === discordIds.length) return existing;

		const promises = nonExistingDiscordIds.map((id) => {
			const thisPromise = Promise.withResolvers<DiscordToRobloxData>();
			_dUserRequestQueue.push(id, [thisPromise.resolve, thisPromise.reject, 0, guildId]);
			return thisPromise.promise;
		});
		//_dKeysAddedSinceLastRun += nonExistingDiscordIds.length;
		const results = await Promise.allSettled(promises);
		results.forEach((res, index) => {
			if (res.status === 'fulfilled' && res.value) existing.push(res.value);
			else if (res.status === 'rejected') {
				Logging.log({
					logType: Logging.Type.Error,
					extents: [GuildFlag.LogErrors],
					formatData: {
						msg: `Failed to fetch Discord to Roblox data for Discord ID ${nonExistingDiscordIds[index]}`,
						action: 'Fetching Discord to Roblox data',
						cause: res.reason instanceof Error ? res.reason.message : res.reason,
						userId: nonExistingDiscordIds[index],
					},
					data: { guildId },
				});
			}
		});
		return existing;
	}

	/**
	 * Fetches Roblox to Discord data for multiple Roblox users from the Rover API.
	 * Results are cached.
	 *
	 * @param guildId - The Discord guild ID to query data for
	 * @param robloxIds - Array of Roblox user IDs to fetch Discord data for
	 * @returns Promise resolving to an array of {@link RobloxToDiscordData} objects containing the mapped user data
	 * @throws Will recursively retry if rate limited, throws error if Retry-After header is invalid
	 */
	export async function robloxToDiscordData(guildId: string, robloxIds: RobloxUserId[]) {
		if (!roverConfig) {
			Debug.error('RoVer config not found. Cannot fetch Roblox to Discord data.');
			throw new Error('RoVer config not found. Cannot fetch Roblox to Discord data.');
		}
		if (robloxIds.length === 0) return [];
		const existing = [] as RobloxToDiscordData[];
		const nonExistingRobloxIds = [] as RobloxUserId[];
		robloxIds.forEach((id) => {
			if (RbxCaches.robloxToDiscordData.has(id)) existing.push(RbxCaches.robloxToDiscordData.get(id)!);
			else nonExistingRobloxIds.push(id);
		});
		if (existing.length === robloxIds.length) return existing;
		const promises = nonExistingRobloxIds.map((id) => {
			const thisPromise = Promise.withResolvers<RobloxToDiscordData>();
			_rUserRequestQueue.push(id, [thisPromise.resolve, thisPromise.reject, 0, guildId]);
			thisPromise.promise.then((val) => {
				return val;
			});
			return thisPromise.promise;
		});
		//_rKeysAddedSinceLastRun += nonExistingRobloxIds.length;
		const results = await Promise.allSettled(promises);
		results.forEach((res, index) => {
			if (res.status === 'fulfilled' && res.value) existing.push(res.value);
			else if (res.status === 'rejected') {
				Logging.log({
					logType: Logging.Type.Error,
					extents: [GuildFlag.LogErrors],
					formatData: {
						msg: `Failed to fetch Roblox to Discord data for Roblox ID ${nonExistingRobloxIds[index]}`,
						action: 'Fetching Roblox to Discord data',
						cause: res.reason instanceof Error ? res.reason.message : res.reason,
					},
					data: { guildId },
				});
			}
		});
		return existing;
	}
}
