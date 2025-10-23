export default {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		tsconfigRootDir: '.',
		//sourceType: 'module',
	},
	plugins: ['@typescript-eslint', 'prettier'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
	rules: {
		'prettier/prettier': 'error',
	},
};
