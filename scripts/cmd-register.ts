import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes, SlashCommandBuilder } from 'discord.js';
import { token, clientId } from '../src/config.json';
import { commands } from '../src/commands';
import { Config } from '../src/config';
import { argv } from 'process';

const rest = new REST().setToken(token);
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

const environ = argv[2];
if (environ !== 'dev' && environ !== 'prod') {
	throw new Error('Invalid environment. Must be "dev" or "prod"');
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
