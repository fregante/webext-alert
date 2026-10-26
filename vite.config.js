import {defineConfig} from 'vite';

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
			external: [/^webext-/v],
		},
	},
});
