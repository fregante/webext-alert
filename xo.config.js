import globals from 'globals';

/**
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
	{
		ignores: ['demo/package.json'],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.webextensions,
			},
		},
		rules: {
			'no-alert': 'off',
			'unicorn/consistent-boolean-name': 'off',
			'@typescript-eslint/no-restricted-types': 'off',
		},
	},
];

export default xoConfig;
