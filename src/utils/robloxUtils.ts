import axios from 'axios';
import { Debug } from './errorsUtils.js';
import urlBuilder from 'build-url-ts';
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

namespace Caches {
	/** Uses requested usernames as keys */
	export const usernamesToData: Map<RobloxUsername, UsernameToUserData> = new Map<
		RobloxUsername,
		UsernameToUserData
	>();
	export const idsToData: Map<RobloxUserId, IdToUserData> = new Map<RobloxUserId, IdToUserData>();
	export const idsToAvatarBusts: Map<RobloxUserId, IdToAvatarBust> = new Map<RobloxUserId, IdToAvatarBust>();
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
			if (Caches.usernamesToData.has(username)) existing.push(Caches.usernamesToData.get(username)!);
		});
		if (existing.length === usernames.length) return existing;
		return axios
			.post('https://users.roblox.com/v1/usernames/users', {
				usernames: usernames.filter((username) => !Caches.usernamesToData.has(username)),
				excludeBannedUsers: true,
			})
			.catch((err) => Debug.error(`Failed to convert usernames to data: ${err}`))
			.then((res) => {
				if (!res) return existing;
				existing.push(...(res.data.data as UsernameToUserData[]));
				existing.forEach((user) => Caches.usernamesToData.set(user.requestedUsername, user));
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
			if (Caches.idsToData.has(id)) existing.push(Caches.idsToData.get(id)!);
		});
		if (existing.length === ids.length) return existing;
		return axios
			.post('https://users.roblox.com/v1/users', {
				userIds: ids.filter((id) => !Caches.idsToData.has(id)),
			})
			.catch((err) => Debug.error(`Failed to convert ids to data: ${err}`))
			.then((res) => {
				if (!res) return existing;
				existing.push(...(res.data.data as IdToUserData[]));
				existing.forEach((user) => Caches.idsToData.set(user.id, user));
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
			if (Caches.idsToAvatarBusts.has(id)) {
				existing.push(Caches.idsToAvatarBusts.get(id)!);
			}
		});
		if (existing.length === ids.length) return existing;
		return axios
			.get(
				buildUrl('https://thumbnails.roblox.com/v1/users/avatar-bust', {
					queryParams: {
						userIds: ids.filter((id) => !Caches.idsToAvatarBusts.has(id)),
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
				existing.forEach((avtr) => Caches.idsToAvatarBusts.set(avtr.targetId, avtr));
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
