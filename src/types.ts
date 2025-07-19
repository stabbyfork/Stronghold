import {
	ChatInputCommandInteraction,
	ClientEvents,
	SlashCommandBuilder,
} from 'discord.js';

export interface CommandConstruct {
	data: SlashCommandBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export function createEvent<E extends keyof ClientEvents>({
	name,
	once,
	execute,
}: {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
}): EventConstruct<E> {
	return { name, once, execute };
}
interface EventConstruct<E extends keyof ClientEvents> {
	name: E;
	once: boolean;
	execute: (...args: ClientEvents[E]) => Promise<void>;
}
