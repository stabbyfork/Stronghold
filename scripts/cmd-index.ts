import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { CommandConstruct } from '../src/types/commandTypes.js';
import { SubcommandMap } from '../src/types/subcommandTypes.js';
import { flattenVals } from '../src/utils/genericsUtils.js';
import { getSubcommands } from '../src/utils/subcommandsUtils.js';

const outPath = 'src/commands.ts';
const optionsOutPath = 'src/cmdOptions.ts';

let cmdDir: string;
if (process.argv.length == 3) {
	cmdDir = process.argv[2];
} else {
	cmdDir = 'src/commands';
}

const isTSFile = (file: string) => file.endsWith('.ts') && !file.endsWith('.d.ts');

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
	const entries: [CommandConstruct, string][] = [];

	for (const file of walk(cmdDir)) {
		const relPath = './' + path.relative('src', file).replace(/\\/g, '/'); // for import
		const importPath = pathToFileURL(path.resolve(file)).toString();
		const mod = await import(importPath);

		const cmd = mod?.default;

		// Basic type check for CommandConstruct
		if (cmd && typeof cmd === 'object' && typeof cmd.data === 'object') {
			entries.push([cmd, relPath.replace('.ts', '.js')]);
		}
	}
	const flatSubcmds: string[] = [];
	for (const [cmd, _] of entries) {
		const subs = getSubcommands(cmd.data as SlashCommandBuilder);
		if (typeof subs !== 'string') {
			flatSubcmds.push(...(flattenVals(subs) as string[]));
		}
	}
	const tsOutput = `// AUTO-GENERATED ON ${new Date().toUTCString().toUpperCase()} WITH ${entries.length} TOP-LEVEL COMMAND${
		entries.length === 1 ? '' : 'S'
	} AND DERIVED FROM ${cmdDir}; SOURCE OF TRUTH

import type { CommandConstruct, CommandExecute } from './types/commandTypes.js';

${entries.map(([cmd, rel]) => `import ${cmd.data.name} from '${rel}';`).join('\n')}

${flatSubcmds.map((sub) => `import ${sub.replaceAll(' ', '_')} from '${'./commands/' + sub.replaceAll(' ', '/') + '.js' /*May break if the path changes*/}';`).join('\n')}

export const commands = {
${entries.map(([cmd]) => `  '${cmd.data.name}': ${cmd.data.name},`).join('\n')}
} as const satisfies { [key: string]: CommandConstruct<boolean, any> };

export const subcommands = {
${entries
	.filter(([cmd]) => {
		let cds = getSubcommands(cmd.data as SlashCommandBuilder);
		if (typeof cds === 'string') {
			return false;
		}
		return true;
	})
	.map(([cmd]) => {
		const cds = getSubcommands(cmd.data as SlashCommandBuilder, '_') as SubcommandMap;
		return `${cmd.data.name}: ${JSON.stringify(cds, null, 2).replaceAll('"', '')},`;
	})
	.join('\n')}
} as const satisfies {
	[K in keyof Partial<typeof commands>]: { [key: string]: CommandExecute<any> | { [key: string]: CommandExecute<any> } };
};
`;

	fs.writeFileSync(
		optionsOutPath,
		`// AUTO-GENERATED ON ${new Date().toUTCString().toUpperCase()} WITH ${entries.length} TOP-LEVEL COMMAND${
			entries.length === 1 ? '' : 'S'
		} AND DERIVED FROM ${cmdDir}; SOURCE OF TRUTH

import type { CommandConstruct } from "./types/commandTypes.js";

export const commandOptions = {
${entries
	.map(([cmd]) => {
		return `${cmd.data.name}: ${JSON.stringify(cmd.options, null, 2)},`;
	})
	.join('\n')}
} as const satisfies {
	[key: string]: CommandConstruct['options'];
}

export type CommandList<T> = {
${entries
	.filter(([cmd]) => {
		let cds = getSubcommands(cmd.data as SlashCommandBuilder);
		if (typeof cds === 'string') {
			return false;
		}
		return true;
	})
	.map(([cmd]) => {
		const cds = getSubcommands(cmd.data as SlashCommandBuilder, '_') as SubcommandMap;
		return `${cmd.data.name}: ${JSON.stringify(cds, null, 2)
			.replaceAll('"', '')
			.replaceAll(/(\w+): (\w+)/g, '$1: T')},`;
	})
	.join('\n')}	
};
`,
	);
	fs.writeFileSync(outPath, tsOutput);
	console.log(
		`Generated at ${outPath} with ${entries.length} top-level command${
			entries.length === 1 ? '' : 's'
		} and ${flatSubcmds.length} subcommand${flatSubcmds.length === 1 ? '' : 's'}`,
	);
}

await build();

console.log('Finished command indexing');
