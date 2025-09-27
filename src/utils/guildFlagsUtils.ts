//#region Guild Flags

import { checkBits } from './genericsUtils.js';

export type GuildFlagField = number;
export enum GuildFlag {
	LogAll = 'logAll',
	LogErrors = 'logErrors',
	LogWarnings = 'logWarnings',
	LogInfo = 'logInfo',
	LogDebug = 'logDebug',
}
/**
 * Index using {@link GuildFlag}
 */
export const GuildFlagBits = {
	[GuildFlag.LogAll]: 0b1,
	[GuildFlag.LogErrors]: 0b10,
	[GuildFlag.LogWarnings]: 0b100,
	[GuildFlag.LogInfo]: 0b1000,
	[GuildFlag.LogDebug]: 0b10000,
} as const satisfies { [K in GuildFlag]: number };
checkBits(GuildFlagBits);
export function includesGuildFlags(flags: GuildFlagField, ...flagsToCheck: GuildFlag[]): boolean;
export function includesGuildFlags(
	flags: GuildFlagField,
	...flagsToCheck: (typeof GuildFlagBits)[GuildFlag][]
): boolean;
export function includesGuildFlags(
	flags: GuildFlagField,
	...flagsToCheck: GuildFlag[] | (typeof GuildFlagBits)[GuildFlag][]
) {
	if (typeof flagsToCheck[0] === 'string') {
		const bits = flagsToCheck.reduce((acc, flag) => acc | GuildFlagBits[flag as GuildFlag], 0);
		return (flags & bits) === bits;
	} else {
		const bits = flagsToCheck.reduce((acc, flag) => acc | (flag as number), 0);
		return (flags & bits) === bits;
	}
}

//#endregion
