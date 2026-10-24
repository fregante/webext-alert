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
		},
	},
];

export default xoConfig;
