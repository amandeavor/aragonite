// How code names the library: the `#lib` alias package.json `imports` declares for source files,
// and the entry points its `exports` publishes. The source scans and the consumer plugin sync read
// both through here, so each is spelled in package.json alone.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A path, not a URL: under a jsdom test the global URL is jsdom's, which `fs` refuses.
const PACKAGE_JSON = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');

const PACKAGE = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
/** @type {Record<string, string>} */
const IMPORTS = PACKAGE.imports ?? {};

const repoPath = (/** @type {string} */ target) => target.replace(/^\.\//, '');

/** Node refuses a `*` match with a `.`, `..` or `node_modules` path segment. */
const isValidMatch = (/** @type {string} */ middle) =>
	middle.split(/[/\\]/).every((part) => !['.', '..', 'node_modules'].includes(part.toLowerCase()));

/**
 * Whether a specifier is spelled with a package.json `imports` key, whether or not it maps to a
 * file (`#lib/x.js` is, `#fff` isn't).
 * @param {string} specifier
 * @returns {boolean}
 */
export function isAliasSpelling(specifier) {
	return Object.keys(IMPORTS).some((key) =>
		key.includes('*') ? specifier.startsWith(key.split('*')[0]) : specifier === key
	);
}

/**
 * The repo path a `#` specifier names (`#lib/core/parser.js` names `src/lib/core/parser.js`), or
 * null when no `imports` key matches it Node's way or its `*` part has a segment Node refuses.
 * @param {string} specifier
 * @returns {string | null}
 */
export function aliasPath(specifier) {
	if (!specifier.startsWith('#')) return null;
	if (!specifier.includes('*') && Object.hasOwn(IMPORTS, specifier)) {
		return repoPath(IMPORTS[specifier]);
	}
	let best = null;
	for (const [key, target] of Object.entries(IMPORTS)) {
		const [prefix, suffix] = key.split('*');
		if (suffix === undefined || specifier.length < key.length) continue;
		if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
		const longer =
			best === null ||
			prefix.length > best.prefix.length ||
			(prefix.length === best.prefix.length && key.length > best.key.length);
		if (longer) best = { key, prefix, suffix, target };
	}
	if (best === null) return null;
	const middle = specifier.slice(best.prefix.length, specifier.length - best.suffix.length);
	return isValidMatch(middle) ? repoPath(best.target.replace('*', middle)) : null;
}

/**
 * The `#` specifier that imports a repo file or directory, a `.ts` file spelled `.js` the way an
 * import names it (`src/lib/core/parser.ts` is `#lib/core/parser.js`).
 * @param {string} relPath
 * @returns {string}
 */
export function aliasSpecifier(relPath) {
	const written = relPath.replace(/\.ts$/, '.js');
	for (const [key, target] of Object.entries(IMPORTS)) {
		if (!key.includes('*') && repoPath(target) === written) return key;
	}
	for (const [key, target] of Object.entries(IMPORTS)) {
		const [prefix, suffix] = repoPath(target).split('*');
		if (suffix === undefined || !written.startsWith(prefix) || !written.endsWith(suffix)) continue;
		return key.replace('*', written.slice(prefix.length, written.length - suffix.length));
	}
	throw new Error(`no package.json imports entry covers ${relPath}`);
}

/**
 * @typedef {object} EntryPoint
 * @property {string} subpath The `exports` key, e.g. `./plugin`.
 * @property {string} source The library file it is built from, e.g. `src/lib/plugin.ts`.
 * @property {string} svelte The `svelte` condition's build, e.g. `dist/plugin.js`.
 * @property {string} prebuilt The `default` condition's build, e.g. `dist/prebuilt/plugin.js`.
 */

/**
 * Each published JavaScript entry point in package.json `exports`, with both of its builds. Throws on
 * an entry whose `default` is not its `svelte` path moved under `dist/prebuilt/` (G4.174).
 * @returns {EntryPoint[]}
 */
export function publishedEntryPoints() {
	/** @type {EntryPoint[]} */
	const out = [];
	for (const [subpath, target] of Object.entries(PACKAGE.exports ?? {})) {
		if (typeof target !== 'object') continue;
		const svelte = repoPath(target.svelte ?? '');
		const prebuilt = repoPath(target.default ?? '');
		const built = /^dist\/(.+)\.js$/.exec(svelte);
		if (built === null || prebuilt !== `dist/prebuilt/${built[1]}.js`) {
			throw new Error(
				`package.json exports["${subpath}"] needs "svelte": "./dist/<path>.js" and "default": ` +
					`"./dist/prebuilt/<path>.js", but has "${svelte}" and "${prebuilt}"`
			);
		}
		out.push({ subpath, source: `src/lib/${built[1]}.ts`, svelte, prebuilt });
	}
	return out;
}

/**
 * Each published entry point's library path, as an import names it, mapped to the package
 * specifier a consumer imports it by (`src/lib/plugin.js` to `@voithos-labs/aragonite/plugin`).
 * @returns {Map<string, string>}
 */
export function publishedEntries() {
	return new Map(
		publishedEntryPoints().map(({ subpath, source }) => [
			source.replace(/\.ts$/, '.js'),
			`${PACKAGE.name}${subpath.slice(1)}`
		])
	);
}
