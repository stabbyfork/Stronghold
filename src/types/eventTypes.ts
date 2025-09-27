//#region Events

import { ClientEvents } from 'discord.js';

export enum GlobalCustomIds {
	InSessionButton = 'in-session-button',
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
//#endregion
