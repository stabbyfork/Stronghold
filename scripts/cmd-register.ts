import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes, SlashCommandBuilder } from 'discord.js';
import { argv } from 'process';
import { commands } from '../src/commands';
import { Config } from '../src/config';
import { clientId, token } from '../src/config.json';

const environ = argv[2];
if (environ !== 'dev' && environ !== 'prod') {
	throw new Error('Invalid environment. Must be "dev" or "prod"');
}

const rest = new REST();
if (environ === 'dev') {
	const dev = Config.get('dev');
	if (dev) {
		rest.setToken(dev.token);
	} else {
		throw new Error('No development bot token found');
	}
} else {
	rest.setToken(token);
}
function flattenCmds(obj: { [key: string]: unknown }) {
	const out: RESTPostAPIApplicationCommandsJSONBody[] = [];
	for (const [_, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			if ('data' in val) {
				out.push((val.data as SlashCommandBuilder).toJSON());
			} else {
				out.push(...flattenCmds(val as { [key: string]: unknown }));
			}
		}
	}
	return out;
}

await (async () => {
	try {
		const cmdArray = flattenCmds(commands);
		if (environ === 'prod') {
			console.log(`Refreshing ${cmdArray.length} slash command${cmdArray.length === 1 ? '' : 's'} in production`);
			await rest.put(Routes.applicationCommands(clientId), {
				body: cmdArray,
			});
		} else {
			const dev = Config.get('dev');
			if (dev) {
				console.log(
					`Refreshing ${cmdArray.length} slash command${cmdArray.length === 1 ? '' : 's'} in development`,
				);
				if (dev.devServerId) {
					console.log('Sending to development server');
					await rest.put(Routes.applicationGuildCommands(dev.clientId, dev.devServerId), {
						body: cmdArray,
					});
				} else {
					console.log('Sending to all servers');
					await rest.put(Routes.applicationCommands(dev.clientId), {
						body: cmdArray,
					});
				}
			} else {
				throw new Error('No dev config found');
			}
		}

		console.log(`Successfully refreshed slash commands`);
	} catch (error) {
		console.error(`Error while refreshing slash commands: ${error}`);
	}
})();
