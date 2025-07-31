import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Data } from './data.js';
import { Config } from './config.js';
import { Debug } from './utils.js';

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
							'dist',
							path.relative(
								workDir,
								path.join(dir, file).replace('.ts', '.js'),
							),
						),
					).toString()
				);
			} catch (err) {
				Debug.error(`Error while importing ${file}: ${err}`);
				return undefined;
			}
		});

	Promise.all(files).then((modules) => {
		modules.forEach((module) => {
			if (!module) return;
			const evt = module.default;
			if (!(evt && 'name' in evt && 'once' in evt && 'execute' in evt))
				return;
			if (evt.once) client.once(evt.name, evt.execute);
			else client.on(evt.name, evt.execute);
			evt.onConnect?.();
		});
	});
}

function safeShutdown(signal: NodeJS.Signals) {
	console.log('Shutting down with signal', signal);
	Promise.all([client.destroy(), Data.closeDb()])
		.then(() => process.exit(0))
		.catch((err) => {
			Debug.error(err);
			process.exit(1);
		});
}

await Data.setup();
await registerEvents('src/events', 'src');

process.on('SIGINT', safeShutdown).on('SIGTERM', safeShutdown);

client.login(Config.get('token'));
process.send?.('ready');
