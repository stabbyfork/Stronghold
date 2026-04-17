import { Environment } from './types/envTypes.js';

export const ENV = {
	NODE_ENV: process.env.NODE_ENV as Environment.Development | Environment.Production,
	MAIN: process.env.MAIN === 'true',
} as const satisfies {
	NODE_ENV: Environment.Development | Environment.Production;
	MAIN: boolean;
};

if (!ENV.NODE_ENV && ENV.MAIN) {
	throw new Error('NODE_ENV not set in MAIN environment');
}
if (ENV.NODE_ENV !== Environment.Development && ENV.NODE_ENV !== Environment.Production && ENV.MAIN) {
	throw new Error('Invalid NODE_ENV. Must be "dev" or "prod"');
}
if (ENV.MAIN === undefined) {
	throw new Error('MAIN not set');
}
