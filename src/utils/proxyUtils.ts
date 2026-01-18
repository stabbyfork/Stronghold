import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { Config } from '../config.js';
import { Errors } from '../types/errors.js';
import { Environment } from '../types/envTypes.js';

//const defaultCmds = [] as RESTPostAPIChatInputApplicationCommandsJSONBody[];

/** GuildId -> [Commands] */
const proxyCache = new Map<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]>();

export namespace ProxyUtils {
	const rest = new REST();
	let clientId: string;
	if (process.env.NODE_ENV === Environment.Production) {
		rest.setToken(Config.get('token'));
		clientId = Config.get('clientId');
	} else {
		const dev = Config.get('dev');
		if (!dev) {
			throw new Errors.NotFoundError('No dev config found');
		}
		rest.setToken(dev.token);
		clientId = dev.clientId;
	}
	export async function set(guildId: string, ...commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]) {
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
		proxyCache.set(guildId, commands);
	}
	export async function remove(guildId: string, ...commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]) {
		get(guildId).then(async (data) => {
			const newCmds = (data as RESTPostAPIChatInputApplicationCommandsJSONBody[]).filter(
				(cmd) => !commands.includes(cmd),
			);
			await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
				body: newCmds,
			});
			proxyCache.set(guildId, newCmds);
		});
	}
	export async function clear(guildId: string) {
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
		proxyCache.set(guildId, []);
	}
	export async function get(guildId: string) {
		if (proxyCache.has(guildId))
			return proxyCache.get(guildId) as RESTPostAPIChatInputApplicationCommandsJSONBody[];
		return rest.get(Routes.applicationGuildCommands(clientId, guildId)).then(async (data) => {
			proxyCache.set(guildId, data as RESTPostAPIChatInputApplicationCommandsJSONBody[]);
			return data as RESTPostAPIChatInputApplicationCommandsJSONBody[];
		});
	}
}
