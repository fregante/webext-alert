import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const resolve = path => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	root: resolve('..'),
	base: './',
	publicDir: false,
	resolve: {
		alias: {
			'webext-alert': resolve('../source/index.ts'),
		},
	},
	plugins: [
		{
			name: 'emit-manifest',
			generateBundle() {
				this.emitFile({
					type: 'asset',
					fileName: 'manifest.json',
					source: readFileSync(resolve('manifest.json'), 'utf8')
						.replace('./unrelated-popup.html', './demo/unrelated-popup.html'),
				});
			},
		},
	],
	build: {
		outDir: resolve('dist'),
		emptyOutDir: true,
		target: 'chrome120',
		sourcemap: 'inline',
		rollupOptions: {
			input: {
				background: resolve('background.js'),
				'demo/unrelated-popup': resolve('unrelated-popup.html'),
				'web/index': resolve('../web/index.html'),
			},
			output: {
				entryFileNames: '[name].js',
			},
		},
	},
});
