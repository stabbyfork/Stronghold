module.exports = {
	apps: [
		{
			name: 'overseer-bot',
			script: 'dist/index.js',
			interpreter: 'node',
			interpreter_args: '--trace-deprecation',
			instances: 1,
			wait_ready: true,
			kill_timeout: 3000,
			cron_restart: '0 0 * * *',
			env: {
				NODE_ENV: 'dev',
			},
			env_production: {
				NODE_ENV: 'prod',
			},
		},
	],
};
