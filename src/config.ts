import fs from 'fs';
import { Config as ConfigT } from './schema-types.js';
export namespace Config {
	const config = JSON.parse(
		fs.readFileSync('src/config.json', 'utf-8'),
	) as ConfigT;
	export function get<T extends keyof ConfigT>(key: T): ConfigT[T] {
		return config[key];
	}
}
