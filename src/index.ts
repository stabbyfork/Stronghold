import fs from 'fs';
import path from 'path';
import { Op, Sequelize } from '@sequelize/core';
import { setInterval as yieldInterval } from 'timers/promises';
import { pathToFileURL } from 'url';
import { client } from './client.js';
import { Config } from './config.js';
import { Data } from './data.js';
import { Debug, intDiv, runActivityCheckExecute } from './utils.js';

let activityChecksId: NodeJS.Timeout;

async function registerEvents(dir: string, workDir: string) {
	const files = fs
		.readdirSync(dir)
		.filter((file) => file.endsWith('.ts'))
		.map(async (file) => {
			try {
				return await import(
					pathToFileURL(
						path.join('dist', path.relative(workDir, path.join(dir, file).replace('.ts', '.js'))),
					).toString()
				);
			} catch (err) {
				Debug.error(`Error while importing ${file}: ${err}`);
				return undefined;
			}
		});

	await Promise.all(files).then((modules) => {
		modules.forEach((module) => {
			if (!module) return;
			const evt = module.default;
			if (!(evt && 'name' in evt && 'once' in evt && 'execute' in evt)) return;
			if (evt.once) client.once(evt.name, evt.execute);
			else client.on(evt.name, evt.execute);
			evt.onConnect?.();
		});
	});
}

async function safeShutdown(signal: NodeJS.Signals) {
	console.log('Shutting down with signal', signal);
	await Promise.all([client.destroy(), Data.closeDb(), clearInterval(activityChecksId)])
		.then(() => process.exit(0))
		.catch((err) => {
			Debug.error(err);
			process.exit(1);
		});
}

async function runActivityChecks() {
	const checks = await Data.models.ActivityCheck.findAll({
		where: {
			interval: {
				[Op.ne]: null,
			},
			paused: false,
			[Op.and]: Sequelize.where(Sequelize.literal(`lastRun + interval`), {
				[Op.lt]: intDiv(Date.now(), 1000),
			}),
		},
	});
	const gen = (function* () {
		for (const check of checks) {
			yield check;
		}
	})();
	for await (const _ of yieldInterval(10 * 1000)) {
		const nextVal = gen.next();
		if (nextVal.done) return;
		const check = nextVal.value;
		check.lastRun = intDiv(Date.now(), 1000);

		if (!check.currentMessageId) continue;
		await runActivityCheckExecute(check.guildId, check.channelId, check.currentMessageId, check.sequence);
		await check.save();
	}
}

console.log('Initialising data');
await Data.setup();
console.log('Registering events');
await registerEvents('src/events', 'src');
console.log('Registering activity checks');
activityChecksId = setInterval(runActivityChecks, 1000 * 60 * 60);

process
	.on('SIGINT', async (signal) => await safeShutdown(signal))
	.on('SIGTERM', async (signal) => await safeShutdown(signal));

console.log('Logging in');
console.log('Running in', process.env.NODE_ENV);
if (process.env.NODE_ENV !== 'prod') {
	const dev = Config.get('dev');
	if (!dev) throw new Error('No dev config found');
	await client.login(dev.token);
} else {
	await client.login(Config.get('token'));
}

process.send?.('ready');
