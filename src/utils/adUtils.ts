import { Config } from '../config.js';
import { Data } from '../data.js';

export namespace AdUtils {
	const defaultWeight = 1 as const;
	const defaultChance = 1 as const; // Default to always showing an ad if ads are enabled and there are ads in the list;
	export const isEnabled = Config.get('advertisement')?.enabled ?? false;
	const allAds = (Config.get('advertisement')?.list ?? []).sort(
		(a, b) => (b.weight ?? defaultWeight) - (a.weight ?? defaultWeight),
	);
	const chance = Config.get('advertisement')?.adChance ?? defaultChance;
	const totalWeight = allAds.reduce((sum, ad) => sum + (ad.weight ?? defaultWeight), 0);

	/** Server ID -> User ID -> Ads enabled */
	const enabledCache = new Map<string, Map<string, boolean>>();

	/**
	 * Checks if ads are enabled and there are ads in the list, then randomly selects an ad based on their weights and the adChance.
	 * @returns The selected ad or null if no ad is selected.
	 */
	export async function weightedChancedRandomAd(guildId: string, userId: string) {
		if (!isEnabled) return null;
		if (allAds.length === 0) return null;
		if (Math.random() > chance) return null; // Check if the ad should be shown based on the adChance
		if ((await isEnabledForUser(guildId, userId)) === false) return null; // Check if ads are enabled for the user in this guild
		const randomNum = Math.random() * totalWeight;
		let weightSum = 0;
		for (const ad of allAds) {
			weightSum += ad.weight ?? defaultWeight;
			if (randomNum < weightSum) {
				return ad;
			}
		}
		throw new Error('Failed to select an advert. This should never happen if totalWeight is calculated correctly.');
	}

	async function isEnabledForUser(guildId: string, userId: string) {
		if (enabledCache.has(guildId) && enabledCache.get(guildId)!.has(userId)) {
			return enabledCache.get(guildId)!.get(userId)!;
		}
		const enabled = await Data.models.User.findOne({
			where: {
				guildId,
				userId,
			},
			attributes: ['adsEnabled', 'id'],
		}).then((user) => user?.adsEnabled ?? false);
		setCache(guildId, userId, enabled);
		return enabled;
	}

	export function setCache(guildId: string, userId: string, enabled: boolean) {
		if (!enabledCache.has(guildId)) {
			enabledCache.set(guildId, new Map());
		}
		enabledCache.get(guildId)!.set(userId, enabled);
	}
}
