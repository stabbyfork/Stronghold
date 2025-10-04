module.exports = {
	apps: [
		{
			name: 'vaelstrom',
			script: 'dist/index.js',
			interpreter: 'node',
			interpreter_args: '--trace-deprecation',
			wait_ready: true,
			kill_timeout: 3000,
			cron_restart: '0 0 * * *',
			max_memory_restart: '500M',
			env: {
				NODE_ENV: 'dev',
			},
			env_production: {
				NODE_ENV: 'prod',
			},
		},
	],
};
