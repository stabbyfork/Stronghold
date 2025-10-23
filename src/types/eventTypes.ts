//#region Events

import { ClientEvents } from 'discord.js';

export enum GlobalCustomIds {
	InSessionJoin = 'in-session-join',
	InSessionLeave = 'in-session-leave',
}

/**
 * Creates an event construct for a given event.
 * @template E The event name to create an event for.
 * @param options The options for the event.
 * @param options.name The name of the event.
 * @param options.once Whether the event is once or not.
 * @param options.execute The function to call when the event is emitted.
 * @returns The event construct.
 */
export function createEvent<E extends keyof ClientEvents>({
	name,
	once,
	execute,
	onConnect,
}: {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
	onConnect?: () => Promise<void>;
}): EventConstruct<E> {
	return { name, once, execute, onConnect };
}
interface EventConstruct<E extends keyof ClientEvents> {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
	onConnect?: () => Promise<void>;
}

export type InformedCustomId<T extends readonly string[]> =
	// If T is a wide array whose element type includes `string`, fallback to a generic pattern
	string extends T[number]
		? `${string}`
		: T extends [infer First extends string]
			? First
			: T extends [infer First extends string, ...infer Rest extends string[]]
				? `${First}:${InformedCustomId<Rest>}`
				: never;

export namespace InformedCustomId {
	const CUSTOM_ID_REGEX = /^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)*$/;
	/**
	 * Deconstructs a custom id into its name and data parts.
	 * @param customId The custom id to deconstruct.
	 * @returns An object with the name and data parts of the custom id.
	 */
	export function deformat(customId: InformedCustomId<[string]>) {
		const data = customId.split(':');
		return {
			name: data[0],
			data: data.slice(1),
		};
	}
	/**
	 * Formats a custom id with the given name and data.
	 * If there is no data, it will return the name as is.
	 * If there is data, it will return the name followed by a colon and the data joined by colons.
	 * @param name The name of the custom id.
	 * @param data The data of the custom id.
	 * @returns The formatted custom id.
	 */
	export function format<N extends string, D extends string[]>(
		name: string,
		...data: string[]
	): InformedCustomId<[N, ...D]> {
		return (data.length ? `${name}:${data.join(':')}` : `${name}`) as InformedCustomId<[N, ...D]>;
	}
	export function isValid(customId: string): customId is InformedCustomId<[string]> {
		return CUSTOM_ID_REGEX.test(customId);
	}
}

//#endregion
