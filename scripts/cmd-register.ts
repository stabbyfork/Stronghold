import {
	REST,
	RESTPostAPIApplicationCommandsJSONBody,
	Routes,
	SlashCommandBuilder,
} from 'discord.js';
import { token, clientId } from '../src/config.json';
import { commands } from '../src/commands';

const rest = new REST().setToken(token);
function flattenCmds(obj: { [key: string]: unknown }) {
	const out: RESTPostAPIApplicationCommandsJSONBody[] = [];
	for (const [key, val] of Object.entries(obj)) {
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

(async () => {
	try {
		const cmdArray = flattenCmds(commands);
		console.log(
			`Refreshing ${cmdArray.length} slash command${cmdArray.length === 1 ? '' : 's'}`,
		);

		await rest.put(Routes.applicationCommands(clientId), {
			body: cmdArray,
		});

		console.log(`Successfully refreshed slash commands`);
	} catch (error) {
		console.error(`Error while refreshing slash commands: ${error}`);
	}
})();
