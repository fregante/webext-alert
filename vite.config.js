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
				return 'export default chrome.runtime.getURL("index.html");';
			}
		},
	},
];

// Inline the bundled JS and CSS into the HTML so the hosted page is a single file
const inlineWebAssets = {
	name: 'webext-alert-inline-web-assets',
	enforce: 'post',
	applyToEnvironment: environment => environment.name === 'web',
	generateBundle(options, bundle) {
		const html = bundle['index.html'];
		let source = String(html.source);
		for (const [fileName, file] of Object.entries(bundle)) {
			if (file.type === 'chunk') {
				source = source.replace(
					new RegExp(`<script[^>]*src="[^"]*${fileName}"[^>]*></script>`, 'v'),
					() => `<script type="module">${file.code}</script>`,
				);
			} else if (fileName.endsWith('.css')) {
				source = source.replace(
					new RegExp(`<link[^>]*href="[^"]*${fileName}"[^>]*>`, 'v'),
					() => `<style>${String(file.source)}</style>`,
				);
			} else {
				continue;
			}

			delete bundle[fileName];
		}

		html.source = source;
	},
};

// A single `vite build` produces everything:
// - client: the library in `distribution/module` (plus d.ts files)
// - demo: the demo extension in `distribution/demo`
// - web: the hosted page in `distribution/web`
export default defineConfig({
	// The HTML entries are emitted relative to the root, so use the `web` folder to avoid nesting
	root: resolve('web'),
	base: './',
	publicDir: false,
	plugins: [
		...demoPlugins,
		inlineWebAssets,
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
				modulePreload: false,
				emptyOutDir: true,
				rollupOptions: {
					input: resolve('web/index.html'),
				},
			},
		},
	},
	builder: {},
});
