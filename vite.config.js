import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import dts from 'unplugin-dts/vite';

const resolve = path => fileURLToPath(new URL(path, import.meta.url));
const {dependencies} = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

const demoPlugins = [
	{
		// Resolve the package's `page.html` export to the URL of the bundled HTML entry
		name: 'webext-alert-page-url',
		enforce: 'pre',
		applyToEnvironment: environment => environment.name === 'demo',
		resolveId(id) {
			if (id === 'webext-alert/page.html?url') {
				return '\0webext-alert-page-url';
			}

			if (id === 'webext-alert') {
				return resolve('source/index.ts');
			}
		},
		load(id) {
			if (id === '\0webext-alert-page-url') {
				return 'export default chrome.runtime.getURL("web/index.html");';
			}
		},
	},
	{
		name: 'webext-alert-demo-manifest',
		applyToEnvironment: environment => environment.name === 'demo',
		generateBundle() {
			this.emitFile({
				type: 'asset',
				fileName: 'manifest.json',
				source: readFileSync(resolve('demo/manifest.json'), 'utf8')
					.replace('./unrelated-popup.html', './demo/unrelated-popup.html'),
			});
		},
	},
];

// A single `vite build` produces everything:
// - client: the library in `distribution/module` (plus d.ts files)
// - demo: the demo extension in `distribution/demo`
// - web: the hosted page in `distribution/web`
export default defineConfig({
	base: './',
	publicDir: false,
	plugins: [
		...demoPlugins,
		...[dts({
			include: ['source'],
			tsconfigPath: resolve('tsconfig.json'),
		})].flat().map(plugin => ({
			...plugin,
			applyToEnvironment: environment => environment.name === 'client',
		})),
	],
	build: {
		outDir: 'distribution/module',
		sourcemap: false,
		minify: false,
		target: 'esnext',
		lib: {
			entry: 'source/index.ts',
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
				outDir: 'distribution/demo',
				emptyOutDir: true,
				target: 'chrome120',
				sourcemap: 'inline',
				rollupOptions: {
					input: {
						background: resolve('demo/background.js'),
						page: resolve('web/index.html'),
						'demo/unrelated-popup': resolve('demo/unrelated-popup.html'),
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
				outDir: 'distribution/web',
				emptyOutDir: true,
				rollupOptions: {
					input: resolve('web/index.html'),
				},
			},
		},
	},
	builder: {},
});
