// Gates `dist/prebuilt`, the build a host gets when its bundler doesn't compile Svelte: it carries
// its own Svelte, loads in Node, keeps one plugin registry across its entry points, and stays
// within its size budget. Run by verify-pack.mjs after `npm run package`.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parseAst } from 'vite';
import { publishedEntryPoints } from './lib-alias.mjs';
import { prebuiltExternals } from './pack-manifest.mjs';

const PREBUILT_DIR = 'dist/prebuilt';

// Gzipped bytes, a little above the measured 535,613 of JS and 23,247 of CSS.
const BUDGET = { js: 537_000, css: 23_800 };

/**
 * Every failed check, as a message; an empty list means the prebuilt passed.
 * @returns {Promise<string[]>}
 */
export async function verifyPrebuilt() {
	const failures = [];
	const entries = publishedEntryPoints();
	const files = listFiles(PREBUILT_DIR);
	const missing = entries.filter((entry) => !files.includes(entry.prebuilt));
	if (missing.length > 0 || files.length === 0) {
		return [`no prebuilt build for ${missing.map((entry) => entry.subpath).join(', ')}`];
	}
	const scripts = files.filter((file) => file.endsWith('.js'));
	const imports = new Map(scripts.map((file) => [file, bareImports(file)]));

	for (const [file, specifiers] of imports) {
		const foreign = specifiers.filter((specifier) => !isExternal(specifier));
		if (foreign.length > 0) {
			failures.push(
				`${file} imports ${foreign.join(', ')}, which the prebuilt must carry or list as external`
			);
		}
	}
	failures.push(...(await loadsWithoutDom(entries, imports)));
	failures.push(...(await sharesOneRegistry(entries)));
	failures.push(...overBudget(scripts, files));
	return failures;
}

// ── Checks ───────────────────────────────────────────────────────────────────

/**
 * Imports every entry in Node, where there is no DOM, as a server render does. An entry that imports
 * a stylesheet is skipped: Node loads no CSS, and the source build has the same import.
 * @param {import('./lib-alias.mjs').EntryPoint[]} entries
 * @param {Map<string, string[]>} imports
 */
async function loadsWithoutDom(entries, imports) {
	if ('document' in globalThis) return ['verify-prebuilt must run where there is no DOM'];
	const failures = [];
	for (const entry of entries) {
		if (imports.get(entry.prebuilt)?.some(isStylesheet)) continue;
		try {
			await import(pathToFileURL(path.resolve(entry.prebuilt)).href);
		} catch (error) {
			failures.push(`${entry.prebuilt} fails to import in Node: ${String(error)}`);
		}
	}
	return failures;
}

/**
 * A kind registered through the prebuilt `/plugin` entry must parse through the prebuilt root, or
 * the entries hold separate copies of the registries.
 * @param {import('./lib-alias.mjs').EntryPoint[]} entries
 */
async function sharesOneRegistry(entries) {
	const load = (/** @type {string} */ subpath) => {
		const entry = entries.find((candidate) => candidate.subpath === subpath);
		return import(pathToFileURL(path.resolve(entry?.prebuilt ?? '')).href);
	};
	const root = await load('.');
	const plugin = await load('./plugin');
	root.installPlugins([
		plugin.definePlugin({
			name: 'prebuilt-probe',
			setup() {
				const kind = plugin.declarePluginKind('prebuiltProbe');
				plugin.registerBlockKind(kind, {
					gapEdges: 'none',
					mergeRole: 'not-mergeable',
					editable: true,
					supportsInline: false,
					conformanceFixture: '%%probe\n',
					// The prebuilt can't compile a component, so its one view is the text block.
					view: plugin.textBlockView(),
					opener: {
						priority: 25,
						interruptsParagraph: false,
						tryOpen(/** @type {any} */ ctx) {
							if (!ctx.line.text.startsWith('%%probe')) return null;
							return {
								node: { kind, leadingTrivia: ctx.leadingTrivia, raw: ctx.line.raw },
								consumed: 1
							};
						}
					},
					closure: plugin.simpleLeafClosure({
						focus: { mode: 'implemented', via: 'probe' },
						searchPaint: { mode: 'implemented', via: 'probe' },
						undo: { mode: 'implemented', via: 'probe' },
						simOracle: { mode: 'inherit-default' }
					})
				});
			}
		})
	]);
	const kind = root.parse('%%probe\n').children[0]?.kind;
	return kind === 'prebuiltProbe'
		? []
		: [
				`a kind registered through the prebuilt /plugin parsed as "${kind}" through the prebuilt root`
			];
}

/**
 * @param {string[]} scripts
 * @param {string[]} files
 */
function overBudget(scripts, files) {
	const js = gzippedBytes(scripts);
	const css = gzippedBytes(files.filter((file) => file.endsWith('.css')));
	console.log(`verify-prebuilt: ${js} B of JS and ${css} B of CSS, gzipped`);
	const failures = [];
	if (js > BUDGET.js)
		failures.push(`the prebuilt JS is ${js} B gzipped, over its ${BUDGET.js} B budget`);
	if (css > BUDGET.css)
		failures.push(`the prebuilt CSS is ${css} B gzipped, over its ${BUDGET.css} B budget`);
	return failures;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** @param {string} dir */
function listFiles(dir) {
	try {
		return readdirSync(dir, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) =>
				path.relative('.', path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')
			);
	} catch {
		return [];
	}
}

/**
 * Every specifier a module imports that isn't a relative path, read from the parsed module so an
 * import named in a comment or a string doesn't count.
 * @param {string} file
 * @returns {string[]}
 */
function bareImports(file) {
	/** @type {string[]} */
	const found = [];
	const visit = (/** @type {any} */ node) => {
		if (node === null || typeof node !== 'object') return;
		if (Array.isArray(node)) return node.forEach(visit);
		const isImport = /^(Import|ExportNamed|ExportAll)Declaration$|^ImportExpression$/.test(
			node.type
		);
		const specifier = isImport && node.source?.type === 'Literal' ? node.source.value : null;
		if (typeof specifier === 'string' && !specifier.startsWith('.')) found.push(specifier);
		for (const value of Object.values(node)) visit(value);
	};
	visit(parseAst(readFileSync(file, 'utf8')));
	return found;
}

const EXTERNALS = prebuiltExternals();

/** @param {string} specifier */
const isExternal = (specifier) =>
	EXTERNALS.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/** @param {string} specifier */
const isStylesheet = (specifier) => specifier.endsWith('.css');

/** @param {string[]} files */
const gzippedBytes = (files) =>
	files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
