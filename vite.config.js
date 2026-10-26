import {readFileSync} from 'node:fs';
import {defineConfig} from 'vite';

const {dependencies} = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));

export default defineConfig({
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
});
