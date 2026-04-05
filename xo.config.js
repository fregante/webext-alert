import globals from 'globals';

/** @type {import('xo').FlatXoConfig} */
const xoConfig = [
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
