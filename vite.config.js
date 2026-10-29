import path from 'node:path';
import {defineConfig} from 'vite';
import dts from 'unplugin-dts/vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import {viteSingleFile} from 'vite-plugin-singlefile';
import pkg from './package.json' with {type: 'json'};

const only = (name, plugin) => ({...plugin, applyToEnvironment: environment => environment.name === name});

// A single `vite build` produces everything:
// - client: the library in `distribution/module` (plus d.ts files)
// - demo: the demo extension in `distribution/demo`
// - web: the hosted page in `distribution/web`
export default defineConfig({
	define: {
		// The hosted page is the one published with this exact version of the package
		'import.meta.env.WEB_URL': JSON.stringify(`https://unpkg.com/${pkg.name}@${pkg.version}/distribution/web/index.html`),
	},
	// The HTML entries are emitted relative to the root, so use the `web` folder to avoid nesting
	root: 'web',
	resolve: {
		alias: [
			// The demo imports the package by name, but `distribution/module` doesn't exist yet when it's built
			{find: /^webext-alert\/page\.html\?url$/v, replacement: path.resolve('web/index.html') + '?url'},
			{find: /^webext-alert$/v, replacement: '../source/index.ts'},
		],
	},
	plugins: [
		only('web', viteSingleFile()),
		only('client', dts({include: ['../source']})),
		viteStaticCopy({
			environment: 'demo',
			targets: [{
				src: ['../demo/manifest.json', '../demo/unrelated-popup.html'],
				dest: '.',
				rename: {stripBase: true},
			}],
		}),
	],
	build: {
		modulePreload: false,
		outDir: '../distribution/module',
		emptyOutDir: true,
		minify: false,
		lib: {
			entry: '../source/index.ts',
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: Object.keys(pkg.dependencies).map(name => new RegExp(`^${name}(/|$)`, 'v')),
		},
	},
	environments: {
		demo: {
			consumer: 'client',
			build: {
				outDir: '../distribution/demo',
				sourcemap: 'inline',
				rollupOptions: {
					input: {
						background: '../demo/background.js',
						index: 'index.html',
					},
					output: {
						entryFileNames: '[name].js',
					},
				},
			},
		},
		web: {
			consumer: 'client',
			build: {
				outDir: '../distribution/web',
				rollupOptions: {
					input: 'index.html',
				},
			},
		},
	},
	builder: {},
});
