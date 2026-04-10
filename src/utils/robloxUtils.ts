import axios from 'axios';
import { Debug } from './errorsUtils.js';
import urlBuilder from 'build-url-ts';
import fuzzysort from 'fuzzysort';
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

type RobloxUsername = string;
type RobloxUserId = number;

export namespace RbxCaches {
	/** Uses requested usernames as keys */
	export const usernamesToData: Map<RobloxUsername, UsernameToUserData> = new Map<
		RobloxUsername,
		UsernameToUserData
	>();
	export const idsToData: Map<RobloxUserId, IdToUserData> = new Map<RobloxUserId, IdToUserData>();
	export const idsToAvatarBusts: Map<RobloxUserId, IdToAvatarBust> = new Map<RobloxUserId, IdToAvatarBust>();
	export const preparedUsernames: Fuzzysort.Prepared[] = [];
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
}
