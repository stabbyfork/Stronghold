import { Op, sql } from '@sequelize/core';
import { setInterval as yieldInterval } from 'timers/promises';
import tx2 from 'tx2';
import { client } from './client.js';
import { subcommands } from './commands.js';
import activity_check_create from './commands/activity/checks/create.js';
import { Config } from './config.js';
import { Data } from './data.js';
import { runActivityCheckExecute } from './utils/discordUtils.js';
import { Debug } from './utils/errorsUtils.js';
import { intDiv } from './utils/genericsUtils.js';
import { exec } from 'child_process';
//@ts-ignore
import * as Events from './events/*';
import { GuildFlag } from './utils/guildFlagsUtils.js';
import { Logging } from './utils/loggingUtils.js';

let activityChecksId: NodeJS.Timeout;

async function registerEvents(dir: string, workDir: string) {
	for (const file of Events.default) {
		const evt = file.default;
		if (!(evt && 'name' in evt && 'once' in evt && 'execute' in evt)) continue;
		if (evt.once) client.once(evt.name, evt.execute);
		else client.on(evt.name, evt.execute);
		evt.onConnect?.();
	}
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
			[Op.and]: sql`(${sql.identifier('lastRun')} + ${sql.identifier('interval')}) <= ${intDiv(Date.now(), 1000)}`,
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
activityChecksId = setInterval(runActivityChecks, 60 * 60 * 1000);

process
	.on('SIGINT', async (signal) => await safeShutdown(signal))
	.on('SIGTERM', async (signal) => await safeShutdown(signal));

// Init order fix (VERY HACKY)
// If it ain't broke don't fix it
//@ts-ignore
subcommands.activity.checks.create = activity_check_create;

console.log('Logging in');
console.log('Running in', process.env.NODE_ENV);
if (process.env.NODE_ENV !== 'prod') {
	const dev = Config.get('dev');
	if (!dev) throw new Error('No dev config found');
	await client.login(dev.token);
} else {
	await client.login(Config.get('token'));
}
tx2.action('update:production', (reply) => {
	exec('npm run pullAndRestart:production', (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			console.error(`stderr: ${stderr}`);
			reply({ success: false });
		}
		console.log(`stdout: ${stdout}`);
		reply({ success: true });
	});
});

tx2.action('alterSyncDb', async (reply) => {
	try {
		await Data.mainDb.sync({ alter: { drop: false } });
		reply({ success: true });
	} catch (e) {
		console.error('Error while syncing database', e);
		reply({ success: false, answer: e instanceof Error ? e.message : e });
	}
});

tx2.action('logUpdate', {}, async (params, reply) => {
	const message = (params as string).replace(/\\n/g, '\n');
	const version = (await import('../package.json')).default.version;
	for (const dbGuild of await Data.models.Guild.findAll({ where: { logChannelId: { [Op.ne]: null } } })) {
		const guild = client.guilds.cache.get(dbGuild.guildId) ?? (await client.guilds.fetch(dbGuild.guildId));
		await Logging.log({
			data: {
				guildId: dbGuild.guildId,
			},
			logType: Logging.Type.Info,
			extents: [GuildFlag.LogInfo],
			formatData: `## ${version}\n${message.replace(/@OWNER/, guild.ownerId)}`,
		});
	}
	reply({ success: true });
});

process.send?.('ready');
