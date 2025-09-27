import * as esbuild from 'esbuild';
const ImportGlobPlugin = await import('esbuild-plugin-import-glob');
await esbuild.build({
	entryPoints: ['src/index.ts'],
	bundle: true,
	outfile: 'dist/index.js',
	platform: 'node',
	target: 'esnext',
	packages: 'external',
	sourcemap: true,
	format: 'esm',
	tsconfig: './tsconfig.json',
	plugins: [ImportGlobPlugin.default.default()],
});
