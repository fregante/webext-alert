// Post-build assertions: run `npm run build` first
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {describe, it} from 'node:test';
import packageJson from '../package.json' with {type: 'json'};

const root = path.resolve(import.meta.dirname, '../distribution');

if (!fs.existsSync(root)) {
	throw new Error('distribution/ is missing, run `npm run build` first');
}

const sort = array => array.toSorted((a, b) => a.localeCompare(b));

const files = sort(
	fs.readdirSync(root, {recursive: true, withFileTypes: true})
		.filter(entry => entry.isFile())
		.map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')),
);

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file, relativeUrl) => fs.existsSync(path.join(root, path.dirname(file), relativeUrl));
const isRelative = specifier => specifier.startsWith('./') || specifier.startsWith('../');
const dependencyNames = Object.keys(packageJson.dependencies);

const htmlFiles = files.filter(file => file.endsWith('.html'));
const cssFiles = files.filter(file => file.endsWith('.css'));
const scripts = files.filter(file => file.endsWith('.js'));
const publishedScripts = scripts.filter(file => file.startsWith('module/') || file.startsWith('web/'));
const declarations = files.filter(file => file.endsWith('.d.ts'));

// Literal specifiers of static imports, re-exports and dynamic imports
const getImportSpecifiers = code => code
	.matchAll(/\b(?:from|import)\s*(?:\(\s*)?["'](?<specifier>[^"']+)["']/gv)
	.map(match => match.groups.specifier)
	.toArray();

describe('generated files', () => {
	it('should be exactly the expected set', () => {
		assert.deepEqual(files, [
			'demo/background.js',
			'demo/index.css',
			'demo/index.html',
			'demo/index.js',
			'demo/manifest.json',
			'demo/unrelated-popup.html',
			'module/action-popup.d.ts',
			'module/index.d.ts',
			'module/index.js',
			'module/shared.d.ts',
			'module/window.d.ts',
			'web/index.css',
			'web/index.html',
			'web/index.js',
		]);
	});

	for (const file of files) {
		it(`${file} should not be empty or contain dev server leftovers`, () => {
			const code = read(file);
			assert.notEqual(code.trim(), '');
			assert.doesNotMatch(code, /\/@vite\/|localhost|__vite__/v);
		});
	}
});

describe('HTML files', () => {
	for (const file of htmlFiles) {
		const html = read(file);
		const references = html
			.matchAll(/\b(?:src|href)=["'](?<url>[^"']*)["']/gv)
			.map(match => match.groups.url)
			.toArray();
		const inlineScripts = html
			.matchAll(/<script\b[^>]*>/gv)
			.map(match => match[0])
			.filter(tag => !/\ssrc=/v.test(tag))
			.toArray();

		it(`${file} should only reference sibling files with relative URLs`, () => {
			// Extension pages and the page hosted on unpkg are not served from the domain root
			assert.deepEqual(references.filter(url => !url.startsWith('./')), []);
			assert.deepEqual(references.filter(url => !exists(file, url)), []);
		});

		it(`${file} should not inline scripts`, () => {
			// Extension pages can't run inline scripts
			assert.deepEqual(inlineScripts, []);
		});
	}

	it('should load the same assets in the demo and in the hosted page', () => {
		assert.equal(read('demo/index.html'), read('web/index.html'));
	});
});

describe('CSS files', () => {
	for (const file of cssFiles) {
		const urls = read(file)
			.matchAll(/url\(\s*["']?(?<url>[^\s"'\)]+)/gv)
			.map(match => match.groups.url)
			.filter(url => !url.startsWith('data:'))
			.toArray();

		it(`${file} should only reference existing relative files`, () => {
			assert.deepEqual(urls.filter(url => !isRelative(url)), []);
			assert.deepEqual(urls.filter(url => !exists(file, url)), []);
		});
	}
});

describe('JavaScript files', () => {
	for (const file of scripts) {
		const specifiers = getImportSpecifiers(read(file));
		const isLibrary = file.startsWith('module/');

		it(`${file} should be valid`, () => {
			// Throws on syntax errors
			assert.equal(execFileSync(process.execPath, ['--check', path.join(root, file)], {encoding: 'utf8'}), '');
		});

		it(`${file} should not contain unreplaced build-time variables`, () => {
			assert.doesNotMatch(read(file), /import\.meta\.env/v);
		});

		it(`${file} should only import ${isLibrary ? 'its dependencies or local files' : 'local files, with everything bundled'}`, () => {
			// Only the library keeps its dependencies external. Pages must bundle them because they can't resolve bare specifiers
			const isAllowed = specifier => isRelative(specifier)
				|| (isLibrary && dependencyNames.some(name => specifier === name || specifier.startsWith(`${name}/`)));
			assert.deepEqual(specifiers.filter(specifier => !isAllowed(specifier)), []);
		});

		it(`${file} should only import existing files`, () => {
			assert.deepEqual(specifiers.filter(specifier => isRelative(specifier) && !exists(file, specifier)), []);
		});
	}

	for (const file of publishedScripts) {
		it(`${file} should not ship source maps`, () => {
			assert.doesNotMatch(read(file), /sourceMappingURL/v);
		});
	}

	it('should point to the hosted page of this exact version', () => {
		const url = `https://unpkg.com/${packageJson.name}@${packageJson.version}/web/index.html`;
		assert.ok(read('module/index.js').includes(`"${url}"`));
	});
});

describe('type declarations', () => {
	it('should declare exactly what the module exports', () => {
		const exportList = /^export \{(?<names>[^\}]+)\}/mv.exec(read('module/index.js')).groups.names;
		const exported = sort(exportList.split(',').map(name => name.trim()));
		const declared = sort(
			read('module/index.d.ts')
				.matchAll(/\bexport (?:declare )?(?:async )?(?:function|const|class) (?<name>\w+)/gv)
				.map(match => match.groups.name)
				.toArray(),
		);
		assert.deepEqual(declared, exported);
	});

	for (const file of declarations) {
		it(`${file} should only import existing declarations`, () => {
			const missing = getImportSpecifiers(read(file))
				.filter(specifier => isRelative(specifier) && !exists(file, specifier.replace(/\.js$/v, '.d.ts')));
			assert.deepEqual(missing, []);
		});
	}
});

describe('demo extension', () => {
	const manifest = JSON.parse(read('demo/manifest.json'));
	const referenced = [
		manifest.action?.default_popup,
		manifest.background?.service_worker,
		...manifest.background?.scripts ?? [],
	].filter(Boolean);

	it('should be a Manifest V3 extension', () => {
		assert.equal(manifest.manifest_version, 3);
	});

	it('should only reference existing files', () => {
		assert.ok(referenced.length >= 2);
		assert.deepEqual(referenced.filter(url => !exists('demo/manifest.json', url)), []);
	});
});

describe('package.json', () => {
	it('should only point to existing files', () => {
		const targets = [
			packageJson.exports['.'].types,
			packageJson.exports['.'].default,
			packageJson.exports['./page.html'],
			...packageJson.files,
		];
		assert.deepEqual(targets.filter(target => !fs.existsSync(path.resolve(import.meta.dirname, '..', target))), []);
	});

	it('should publish only what the exports need', () => {
		assert.deepEqual(sort(packageJson.files), ['distribution/module', 'distribution/web']);
	});
});
