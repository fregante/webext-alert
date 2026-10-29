// Post-build assertions on what `npm pack` would publish: run `npm run build` first
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {describe, it} from 'node:test';
import packageJson from '../package.json' with {type: 'json'};

const repository = path.resolve(import.meta.dirname, '..');

const sort = array => array.toSorted((a, b) => a.localeCompare(b));

// `--ignore-scripts` skips `prepack`, which would rebuild what is already built
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {cwd: repository, encoding: 'utf8'}));
const packed = sort(pack.files.map(file => file.path));

const read = file => fs.readFileSync(path.join(repository, file), 'utf8');
const toPackedPath = (file, relativeUrl) => path.posix.join(path.posix.dirname(file), relativeUrl);
const isRelative = specifier => specifier.startsWith('./') || specifier.startsWith('../');
const dependencyNames = Object.keys(packageJson.dependencies);

const htmlFiles = packed.filter(file => file.endsWith('.html'));
const cssFiles = packed.filter(file => file.endsWith('.css'));
const scripts = packed.filter(file => file.endsWith('.js'));
const declarations = packed.filter(file => file.endsWith('.d.ts'));

// Every string in `exports`, `main`, `types` and the like, whatever the conditions and nesting
const getTargets = value => {
	if (typeof value === 'string') {
		return [value];
	}

	return value && typeof value === 'object' ? Object.values(value).flatMap(target => getTargets(target)) : [];
};

// Literal specifiers of static imports, re-exports and dynamic imports
const getImportSpecifiers = code => code
	.matchAll(/\b(?:from|import)\s*(?:\(\s*)?["'](?<specifier>[^"']+)["']/gv)
	.map(match => match.groups.specifier)
	.toArray();

describe('npm pack', () => {
	it('should include exactly the expected files', () => {
		assert.deepEqual(packed, [
			'distribution/module/action-popup.d.ts',
			'distribution/module/index.d.ts',
			'distribution/module/index.js',
			'distribution/module/shared.d.ts',
			'distribution/module/window.d.ts',
			'distribution/web/index.css',
			'distribution/web/index.html',
			'distribution/web/index.js',
			'license',
			'package.json',
			'readme.md',
		]);
	});

	it('should include every file that package.json points to', () => {
		const targets = getTargets([
			packageJson.main,
			packageJson.module,
			packageJson.types,
			packageJson.bin,
			packageJson.exports,
		]);

		assert.ok(targets.length >= 3);
		assert.deepEqual(targets.filter(target => !packed.includes(path.posix.normalize(target))), []);
	});

	for (const file of packed) {
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

		it(`${file} should only reference published files with relative URLs`, () => {
			// The page is hosted on unpkg, not at the domain root, and it's also used as an extension page
			assert.deepEqual(references.filter(url => !url.startsWith('./')), []);
			assert.deepEqual(references.filter(url => !packed.includes(toPackedPath(file, url))), []);
		});

		it(`${file} should not inline scripts`, () => {
			// Extension pages can't run inline scripts
			assert.deepEqual(inlineScripts, []);
		});
	}
});

describe('CSS files', () => {
	for (const file of cssFiles) {
		const urls = read(file)
			.matchAll(/url\(\s*["']?(?<url>[^\s"'\)]+)/gv)
			.map(match => match.groups.url)
			.filter(url => !url.startsWith('data:'))
			.toArray();

		it(`${file} should only reference published files with relative URLs`, () => {
			assert.deepEqual(urls.filter(url => !isRelative(url)), []);
			assert.deepEqual(urls.filter(url => !packed.includes(toPackedPath(file, url))), []);
		});
	}
});

describe('JavaScript files', () => {
	for (const file of scripts) {
		const specifiers = getImportSpecifiers(read(file));
		const isLibrary = file.startsWith('distribution/module/');

		it(`${file} should be valid`, () => {
			// Throws on syntax errors
			assert.equal(execFileSync(process.execPath, ['--check', path.join(repository, file)], {encoding: 'utf8'}), '');
		});

		it(`${file} should not contain unreplaced build-time variables or source maps`, () => {
			assert.doesNotMatch(read(file), /import\.meta\.env|sourceMappingURL/v);
		});

		it(`${file} should only import ${isLibrary ? 'its dependencies or published files' : 'published files, with everything bundled'}`, () => {
			// Only the library keeps its dependencies external. The page must bundle them because it can't resolve bare specifiers
			const isAllowed = specifier => isRelative(specifier)
				? packed.includes(toPackedPath(file, specifier))
				: isLibrary && dependencyNames.some(name => specifier === name || specifier.startsWith(`${name}/`));
			assert.deepEqual(specifiers.filter(specifier => !isAllowed(specifier)), []);
		});
	}

	it('should point to the hosted page of this exact version', () => {
		const url = `https://unpkg.com/${packageJson.name}@${packageJson.version}/web/index.html`;
		assert.ok(read('distribution/module/index.js').includes(`"${url}"`));
	});
});

describe('type declarations', () => {
	it('should declare exactly what the module exports', () => {
		const exportList = /^export \{(?<names>[^\}]+)\}/mv.exec(read('distribution/module/index.js')).groups.names;
		const exported = sort(exportList.split(',').map(name => name.trim()));
		const declared = sort(
			read('distribution/module/index.d.ts')
				.matchAll(/\bexport (?:declare )?(?:async )?(?:function|const|class) (?<name>\w+)/gv)
				.map(match => match.groups.name)
				.toArray(),
		);
		assert.deepEqual(declared, exported);
	});

	for (const file of declarations) {
		it(`${file} should only import published declarations`, () => {
			const missing = getImportSpecifiers(read(file))
				.filter(specifier => isRelative(specifier) && !packed.includes(toPackedPath(file, specifier.replace(/\.js$/v, '.d.ts'))));
			assert.deepEqual(missing, []);
		});
	}
});
