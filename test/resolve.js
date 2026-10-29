import config from '../vite.config.js';

// Sources import `./file.js` but they're `.ts` files
export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context);
	} catch (error) {
		if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js')) {
			return nextResolve(specifier.slice(0, -3) + '.ts', context);
		}

		throw error;
	}
}

// Vite replaces `define` entries like `import.meta.env.WEB_URL` at build time, so do the same in Node
export async function load(url, context, nextLoad) {
	const result = await nextLoad(url, context);
	if (!url.endsWith('.ts')) {
		return result;
	}

	let source = String(result.source);
	for (const [key, value] of Object.entries(config.define)) {
		source = source.replaceAll(key, () => value);
	}

	return {...result, source};
}
