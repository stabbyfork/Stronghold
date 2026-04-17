import axios from 'axios';
import urlBuilder from 'build-url-ts';
import fuzzysort from 'fuzzysort';
import { Config } from '../config.js';
import { Debug } from './errorsUtils.js';
import { delayFor } from './genericsUtils.js';
import { Data } from '../data.js';
import path from 'path';
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
			Debug.error('Rover config not found. Cannot fetch Discord to Roblox data.');
			return [];
		}
		if (discordIds.length === 0) return [];
		const existing = [] as DiscordToRobloxData[];
		discordIds.forEach((id) => {
			if (RbxCaches.discordToRobloxData.has(id)) existing.push(RbxCaches.discordToRobloxData.get(id)!);
		});
		if (existing.length === discordIds.length) return existing;
		if (roverLock) {
			if (retryNum > 5) {
				Debug.error('Exceeded maximum retry attempts for Rover API. Aborting fetch Discord -> Roblox.');
				return [];
			}
			const waitTime = 1000 * 2 ** retryNum;
			Debug.error(
				`Rover API is currently rate limited. Waiting ${waitTime}ms before retrying fetch Discord -> Roblox...`,
			);
			await delayFor(waitTime); // Exponential backoff
			return discordToRobloxData(guildId, discordIds, retryNum + 1);
		}
		const results = discordIds.map((id) =>
			axios
				.get(path.posix.join(roverConfig.baseApiUrl, `/guilds/${guildId}/discord-to-roblox/${id}`), {
					headers: { Authorization: `Bearer ${roverConfig.token}` },
					timeout: 10000,
					timeoutErrorMessage: 'Request to Rover API timed out.',
				})
				.then(async (res) => {
					// Big scary rate limiter
					if (res.status === 429) {
						const delayTime = Number(res.headers['Retry-After']);
						if (isNaN(delayTime)) {
							Debug.error(`Invalid Retry-After header value: ${res.headers['Retry-After']}`);
							throw new Error('Rover API rate limited but Retry-After header is invalid');
						}
						roverLock = true;
						await delayFor(delayTime * 1000 + 500); // Add extra 0.5s for safety
						roverLock = false;
					}
					RbxCaches.discordToRobloxData.set(res.data.discordId, res.data);
					return res.data as DiscordToRobloxData;
				}),
		);
		return Promise.all(results).then((res) => {
			if (!res) return [];
			existing.push(...res);
			return existing;
		});
	}
}
