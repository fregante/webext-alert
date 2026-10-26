import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const resolve = path => fileURLToPath(new URL(path, import.meta.url));
const {dependencies} = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

// `vite build` builds the library; `--mode demo` the demo extension; `--mode web` the hosted page
export default defineConfig(({mode}) => {
	if (mode === 'demo') {
		return {
			base: './',
			publicDir: false,
			resolve: {
				alias: [
					{find: /^webext-alert$/v, replacement: resolve('source/index.ts')},
				],
			},
			plugins: [
				{
					// Resolve the package's `page.html` export to the URL of the bundled HTML entry
					name: 'webext-alert-page-url',
					enforce: 'pre',
					resolveId(id) {
						if (id === 'webext-alert/page.html?url') {
							return '\0webext-alert-page-url';
						}
					},
					load(id) {
						if (id === '\0webext-alert-page-url') {
							return 'export default chrome.runtime.getURL("web/index.html");';
						}
					},
				},
				{
					name: 'emit-manifest',
					generateBundle() {
						this.emitFile({
							type: 'asset',
							fileName: 'manifest.json',
							source: readFileSync(resolve('demo/manifest.json'), 'utf8')
								.replace('./unrelated-popup.html', './demo/unrelated-popup.html'),
						});
					},
				},
			],
			build: {
				outDir: 'demo/dist',
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
		};
	}

	if (mode === 'web') {
		return {
			root: 'web',
			base: './',
			build: {
				outDir: '../dist',
				emptyOutDir: true,
			},
		};
	}

	return {
		build: {
			outDir: 'distribution',
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
	};
});
