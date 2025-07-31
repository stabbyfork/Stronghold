module.exports = {
	apps: [
		{
			name: 'overseer-bot',
			script: 'dist/index.js',
			interpreter: 'node',
			watch: ['dist'],
			ignore_watch: ['dist/data.json'],
			wait_ready: true,
			kill_timeout: 3000,
		},
	],
};
