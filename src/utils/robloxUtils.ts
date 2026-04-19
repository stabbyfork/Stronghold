import axios from 'axios';
import urlBuilder from 'build-url-ts';
import fuzzysort from 'fuzzysort';
import { Config } from '../config.js';
import { Debug } from './errorsUtils.js';
import { delayFor } from './genericsUtils.js';
import { Data } from '../data.js';
import path from 'path';
import { userMention } from 'discord.js';
import _ from 'lodash';
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

type RobloxUsername = string;
type RobloxUserId = number;
type DiscordUserId = string;

const roverConfig = Config.get('roblox')?.rover;

export namespace RbxCaches {
	/** Uses requested usernames as keys */
	export const usernamesToData: Map<RobloxUsername, UsernameToUserData> = new Map();
	export const idsToData: Map<RobloxUserId, IdToUserData> = new Map();
	export const idsToAvatarBusts: Map<RobloxUserId, IdToAvatarBust> = new Map();
	export const preparedUsernames: Fuzzysort.Prepared[] = [];

	/** Discord user ID -> Roblox user data (from Rover) */
	export const discordToRobloxData: Map<DiscordUserId, DiscordToRobloxData> = new Map();
}

export namespace Roblox {
	/**
	 * Convert a list of usernames to their corresponding corresponding data.
	 * @param usernames The usernames to convert.
	 * @returns A promise that resolves to an array of {@link UsernameToUserData} objects.
	 * @throws Nothing
	 */
	export async function usernamesToData(...usernames: RobloxUsername[]) {
		if (usernames.length === 0) return [];
		const existing = [] as UsernameToUserData[];
		usernames.forEach((username) => {
			if (RbxCaches.usernamesToData.has(username)) existing.push(RbxCaches.usernamesToData.get(username)!);
		});
		if (existing.length === usernames.length) return existing;
		return axios
			.post(
				'https://users.roblox.com/v1/usernames/users',
				{
					usernames: usernames.filter((username) => !RbxCaches.usernamesToData.has(username)),
					excludeBannedUsers: true,
				},
				{
					timeout: 15000,
					timeoutErrorMessage:
						'Roblox API did not respond within 15 seconds. Perhaps too many users are being requested at once or a username is taking too long to resolve?',
				},
			)
			.catch((err) => Debug.error(`Failed to convert usernames to data: ${err}`))
			.then((res) => {
				if (!res) return existing;
				existing.push(...(res.data.data as UsernameToUserData[]));
				(res.data.data as UsernameToUserData[]).forEach((user) => {
					RbxCaches.usernamesToData.set(user.requestedUsername, user);
					RbxCaches.preparedUsernames.push(fuzzysort.prepare(user.name));
				});
				return existing;
			});
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
		ids.forEach((id) => {
			if (RbxCaches.idsToData.has(id)) existing.push(RbxCaches.idsToData.get(id)!);
		});
		if (existing.length === ids.length) return existing;
		return axios
			.post(
				'https://users.roblox.com/v1/users',
				{
					userIds: ids.filter((id) => !RbxCaches.idsToData.has(id)),
				},
				{
					timeout: 15000,
					timeoutErrorMessage:
						'Roblox API did not respond within 15 seconds. Perhaps too many users are being requested at once or the server is busy?',
				},
			)
			.catch((err) => Debug.error(`Failed to convert ids to data: ${err}`))
			.then((res) => {
				if (!res) return existing;
				existing.push(...(res.data.data as IdToUserData[]));
				(res.data.data as IdToUserData[]).forEach((user) => RbxCaches.idsToData.set(user.id, user));
				return existing;
			});
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
		ids.forEach((id) => {
			if (RbxCaches.idsToAvatarBusts.has(id)) {
				existing.push(RbxCaches.idsToAvatarBusts.get(id)!);
			}
		});
		if (existing.length === ids.length) return existing;
		return axios
			.get(
				buildUrl('https://thumbnails.roblox.com/v1/users/avatar-bust', {
					queryParams: {
						userIds: ids.filter((id) => !RbxCaches.idsToAvatarBusts.has(id)),
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
				return existing;
			});
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

	let roverLock = false;
	let roverUnlockTimer: number | null = null;

	function setRoverUnlock(newId: number, override: boolean) {
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
	 * Fetches Discord to Roblox data for multiple Discord users from the Rover API.
	 * Results are cached.
	 *
	 * @param guildId - The Discord guild ID to query data for
	 * @param discordIds - Array of Discord user IDs to fetch Roblox data for
	 * @returns Promise resolving to an array of {@link DiscordToRobloxData} objects containing the mapped user data
	 *
	 * @throws Will recursively retry if rate limited, throws error if Retry-After header is invalid
	 */
	export async function discordToRobloxData(guildId: string, discordIds: string[], retryNum: number = 0) {
		if (!roverConfig) {
			Debug.error('RoVer config not found. Cannot fetch Discord to Roblox data.');
			throw new Error('RoVer config not found. Cannot fetch Discord to Roblox data.');
		}
		if (discordIds.length === 0) return [];
		const existing = [] as DiscordToRobloxData[];
		discordIds.forEach((id) => {
			if (RbxCaches.discordToRobloxData.has(id)) existing.push(RbxCaches.discordToRobloxData.get(id)!);
		});
		if (existing.length === discordIds.length) return existing;
		if (roverLock) {
			if (retryNum > 5) {
				Debug.error(
					`Exceeded maximum retry attempts for RoVer API. Aborting fetch Discord -> Roblox. (guild ID: ${guildId}, retry number: ${retryNum})`,
				);
				throw new Error('Exceeded maximum retry attempts for the RoVer API, it may be unavailable.');
			}
			const waitTime = 1000 * 2 ** retryNum;
			Debug.error(
				`RoVer API is currently rate limited. Waiting ${waitTime}ms before retrying fetch Discord -> Roblox... (guild ID: ${guildId}, retry number: ${retryNum})`,
			);
			await delayFor(waitTime); // Exponential backoff
			return discordToRobloxData(guildId, discordIds, retryNum + 1);
		}
		const results: Promise<DiscordToRobloxData | null>[] = discordIds.map((id) =>
			axios
				.get(path.posix.join(roverConfig.baseApiUrl, `/guilds/${guildId}/discord-to-roblox/${id}`), {
					headers: { Authorization: `Bearer ${roverConfig.token}` },
					timeout: 10000,
					timeoutErrorMessage: 'Request to RoVer API timed out.',
				})
				.then(
					async (res) => {
						RbxCaches.discordToRobloxData.set(res.data.discordId, res.data);
						return res.data as DiscordToRobloxData;
					},
					async (err) => {
						if (!axios.isAxiosError(err)) {
							Debug.error(
								`Unexpected error type when fetching Discord to Roblox data for ID ${id} in guild ${guildId}: ${err}`,
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
								roverLock = true;
								setRoverUnlock(
									_.delay(() => (roverLock = false), 60000),
									false,
								); // Wait 1 minute before allowing retries again just in case
								throw new Error('RoVer API rate limited but retry-after header is invalid');
							}
							roverLock = true;
							if (delayTime >= 5 * 60 * 1000) {
								setRoverUnlock(
									_.delay(() => (roverLock = false), delayTime * 1000 + 500),
									true,
								); // Add extra 0.5s for safety
								throw new Error(
									`RoVer API rate limited with retry-after of over 5 minutes. The API may be overloaded.`,
								);
							}
							setRoverUnlock(
								_.delay(() => (roverLock = false), delayTime * 1000 + 500),
								true,
							); // Add extra 0.5s for safety
							await delayFor(delayTime * 1000 + 500); // Add extra 0.5s for safety
							return discordToRobloxData(guildId, [id], retryNum).then((data) => data[0]); // Retry the failed ID
						} else if (res?.status === 404) {
							throw new Error(
								`Discord user ${userMention(id)} (id: \`${id}\`) not found in the RoVer database for this server. Is the user verified with RoVer? They can verify here: https://rover.link`,
							);
						} else if (res?.status === 403) {
							Debug.error(
								`Access forbidden when fetching Discord to Roblox data for ID ${id} in guild ${guildId}.`,
							);
							throw new Error(
								'Access forbidden when fetching from RoVer API. Is the RoVer bot installed in this guild? Install it here: https://rover.link',
							);
						} else {
							Debug.error(
								`Failed to fetch Roblox data for Discord user ${id}: ${err.message} in guild ${guildId}`,
							);
							throw err;
						}
					},
				),
		);
		return Promise.all(results).then((res) => {
			if (!res) return [];
			existing.push(...res.filter((d) => d !== null));
			return existing;
		});
	}
}
