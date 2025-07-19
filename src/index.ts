import { Client, GatewayIntentBits } from 'discord.js';
import { token } from './config.json';
import fs from 'fs';
import path from 'path';
import { error } from 'console';
import { pathToFileURL } from 'url';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function registerEvents(dir: string, workDir: string) {
	const files = fs
		.readdirSync(dir)
		.filter((file) => file.endsWith('.ts'))
		.map(async (file) => {
			try {
				return await import(
					pathToFileURL(
						path.join(
							'src',
							path.relative(workDir, path.join(dir, file)),
						),
					).toString()
				);
			} catch (err) {
				error(`Error while importing ${file}: ${err}`);
				return undefined;
			}
		});

	Promise.all(files).then((modules) => {
		modules.forEach((module) => {
			if (!module) return;
			const evt = module.default;
			if (!(evt && evt.name && evt.once && evt.execute)) return;
			if (evt.once) client.once(evt.name, evt.execute);
			else client.on(evt.name, evt.execute);
		});
	});
}

registerEvents('src/events', 'src');

client.login(token);
