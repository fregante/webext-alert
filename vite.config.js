import path from 'node:path';
import {defineConfig} from 'vite';
import dts from 'unplugin-dts/vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {dependencies} from './package.json' with {type: 'json'};

const resolve = file => path.resolve(import.meta.dirname, file);
const demoAssets = ['demo/manifest.json', 'demo/unrelated-popup.html'].map(file => resolve(file));
const dtsPlugin = dts({
	root: resolve('.'),
	include: [resolve('source')],
	tsconfigPath: resolve('tsconfig.json'),
});
const only = (name, plugin) => ({...plugin, applyToEnvironment: environment => environment.name === name});

// A single `vite build` produces everything:
// - client: the library in `distribution/module` (plus d.ts files)
// - demo: the demo extension in `distribution/demo`
// - web: the hosted page in `distribution/web`
export default defineConfig({
	// The HTML entries are emitted relative to the root, so use the `web` folder to avoid nesting
	root: resolve('web'),
	resolve: {
		alias: [
			// The demo imports the package by name, but `distribution/module` doesn't exist yet when it's built
			{find: /^webext-alert\/page\.html\?url$/v, replacement: resolve('web/index.html') + '?url'},
			{find: /^webext-alert$/v, replacement: resolve('source/index.ts')},
		],
	},
	plugins: [
		only('web', viteSingleFile()),
		only('client', dtsPlugin),
		viteStaticCopy({
			environment: 'demo',
			targets: [{
				src: demoAssets,
				dest: '.',
				rename: {stripBase: true},
			}],
		}),
	],
	build: {
		outDir: resolve('distribution/module'),
		emptyOutDir: true,
		minify: false,
		lib: {
			entry: resolve('source/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: Object.keys(dependencies).map(name => new RegExp(`^${name}(/|$)`, 'v')),
		},
	},
	environments: {
		demo: {
			consumer: 'client',
			build: {
				outDir: resolve('distribution/demo'),
				target: 'chrome120',
				sourcemap: 'inline',
				rollupOptions: {
					input: {
						background: resolve('demo/background.js'),
						index: resolve('web/index.html'),
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
				outDir: resolve('distribution/web'),
				rollupOptions: {
					input: resolve('web/index.html'),
				},
			},
		},
	},
	builder: {},
});
