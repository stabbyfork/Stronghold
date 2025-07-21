import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { flattenVals, getSubcommands } from '../src/utils';

const outDir = 'src/commands.ts';

let cmdDir: string;
if (process.argv.length == 3) {
	cmdDir = process.argv[2];
} else {
	cmdDir = 'src/commands';
}

const isTSFile = (file: string) =>
	file.endsWith('.ts') && !file.endsWith('.d.ts');

function* walk(dir: string): Generator<string> {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(fullPath);
		} else if (isTSFile(entry.name)) {
			yield fullPath;
		}
	}
}

async function build() {
	const entries: [SlashCommandBuilder, string][] = [];

	for (const file of walk(cmdDir)) {
		const relPath = './' + path.relative('src', file).replace(/\\/g, '/'); // for import
		const importPath = pathToFileURL(path.resolve(file)).toString();
		const mod = await import(importPath);

		const cmd = mod?.default;

		// Basic type check for CommandConstruct
		if (
			cmd &&
			typeof cmd === 'object' &&
			typeof cmd.data === 'object' &&
			typeof cmd.execute === 'function'
		) {
			entries.push([cmd.data, relPath.replace('.ts', '')]);
		}
	}
	const tsOutput = `// AUTO-GENERATED ON ${new Date().toUTCString().toUpperCase()} WITH ${entries.length} TOP-LEVEL COMMAND${
		entries.length === 1 ? '' : 'S'
	} AND DERIVED FROM ${cmdDir}

import type { CommandConstruct, SubcommandMap } from './types';

${entries.map(([data, rel]) => `import ${data.name} from '${rel}';`).join('\n')}

export const commands = {
${entries.map(([data]) => `  "${data.name}": ${data.name},`).join('\n')}
} as const satisfies { [key: string]: CommandConstruct };

export const subcommands = {
${entries.map(([data]) => `  "${data.name}": ${JSON.stringify(getSubcommands(data), null, 2)},`).join('\n')}
} as const satisfies { [key in keyof typeof commands]: SubcommandMap | string };
`;

	fs.writeFileSync(outDir, tsOutput);
	console.log(
		`Generated at ${outDir} with ${entries.length} command${
			entries.length === 1 ? '' : 's'
		}`,
	);
}

await build();

console.log('Finished command indexing');
