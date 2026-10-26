import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import dts from 'unplugin-dts/vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import {viteSingleFile} from 'vite-plugin-singlefile';

const resolve = path => fileURLToPath(new URL(path, import.meta.url));
const {dependencies} = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

// A single `vite build` produces everything:
// - client: the library in `distribution/module` (plus d.ts files)
// - demo: the demo extension in `distribution/demo`
// - web: the hosted page in `distribution/web`
export default defineConfig({
	// The HTML entries are emitted relative to the root, so use the `web` folder to avoid nesting
	root: resolve('web'),
	base: './',
	publicDir: false,
	resolve: {
		alias: [
			// The demo imports the package by name, but `distribution/module` doesn't exist yet when it's built
			{find: /^webext-alert\/page\.html\?url$/v, replacement: resolve('demo/page-url.js')},
			{find: /^webext-alert$/v, replacement: resolve('source/index.ts')},
		],
	},
	plugins: [
		{
			...viteSingleFile(),
			applyToEnvironment: environment => environment.name === 'web',
		},
		viteStaticCopy({
			environment: 'demo',
			targets: [
				{src: resolve('demo/manifest.json'), dest: '.', rename: {stripBase: true}},
				{src: resolve('demo/unrelated-popup.html'), dest: '.', rename: {stripBase: true}},
			],
		}),
		...[dts({
			root: resolve('.'),
			include: [resolve('source')],
			tsconfigPath: resolve('tsconfig.json'),
		})].flat().map(plugin => ({
			...plugin,
			applyToEnvironment: environment => environment.name === 'client',
		})),
	],
	build: {
		outDir: resolve('distribution/module'),
		emptyOutDir: true,
		sourcemap: false,
		minify: false,
		target: 'esnext',
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
				emptyOutDir: true,
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
				emptyOutDir: true,
				rollupOptions: {
					input: resolve('web/index.html'),
				},
			},
		},
	},
	builder: {},
});
