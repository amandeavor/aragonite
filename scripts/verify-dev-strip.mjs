// A host's production build carries none of the editor's dev checks (G4.247). Vite builds a page that
// imports the editor, through the Svelte build and through the prebuilt one, in development and in
// production: every check tag the development build carries must be gone from the production one.
// Run by verify-pack.mjs after `npm run package`; `node scripts/verify-dev-strip.mjs [root]` checks
// the package at `root` and prints each build's gzipped size.
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';

/** Fewer reached tags than this means the page stopped reaching the editor, not that it's clean. */
const REACHED_FLOOR = 40;

const CHECK_CALL = /\b(?:assertInvariant|devWarn)\(\s*(['"`])([^'"`$\\]+)\1/g;
const QUOTED = /(['"`])([^'"`$\\\n]+)\1/g;

/**
 * Every failure, as a message; an empty list means each production build is clean.
 * @param {string} [root] The package root, holding package.json, src and dist.
 * @returns {Promise<string[]>}
 */
export async function verifyDevStrip(root = '.') {
	const tags = checkTags(path.join(root, 'src/lib'));
	const failures = [];
	const page = mkdtempSync(path.join(tmpdir(), 'dev-strip-'));
	try {
		writePage(page, path.resolve(root));
		for (const route of ['svelte', 'prebuilt']) {
			const development = await buildPage(page, route, 'development');
			const production = await buildPage(page, route, 'production');
			const reached = tags.filter((tag) => carries(development.code, tag));
			console.log(
				`verify-dev-strip: ${route} ${production.gzipped} B gzipped in production, ` +
					`${development.gzipped} B in development, ${reached.length} check tags reached`
			);
			if (reached.length < REACHED_FLOOR) {
				failures.push(
					`the ${route} development build reaches ${reached.length} check tags, under ${REACHED_FLOOR}: is the page still loading the editor?`
				);
			}
			const kept = reached.filter((tag) => carries(production.code, tag));
			if (kept.length > 0) {
				failures.push(
					`the ${route} production build still carries ${kept.length} dev checks, e.g. ${kept.slice(0, 5).join(', ')}`
				);
			}
		}
	} finally {
		rmSync(page, { recursive: true, force: true });
	}
	return failures;
}

// ── The tags ─────────────────────────────────────────────────────────────────

/**
 * The tag each `assertInvariant` and `devWarn` call names, keeping only a tag no other string in
 * the library spells, so finding it in a build means the check shipped.
 * @param {string} libDir
 * @returns {string[]}
 */
function checkTags(libDir) {
	/** @type {Map<string, number>} */
	const atCalls = new Map();
	/** @type {Map<string, number>} */
	const anywhere = new Map();
	for (const file of sourceFiles(libDir)) {
		const text = readFileSync(file, 'utf8');
		for (const [, , tag] of text.matchAll(CHECK_CALL))
			atCalls.set(tag, (atCalls.get(tag) ?? 0) + 1);
		for (const [, , value] of text.matchAll(QUOTED))
			anywhere.set(value, (anywhere.get(value) ?? 0) + 1);
	}
	return [...atCalls].filter(([tag, count]) => anywhere.get(tag) === count).map(([tag]) => tag);
}

/** @param {string} dir @returns {string[]} */
function sourceFiles(dir) {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(ts|svelte)$/.test(entry.name))
		.map((entry) => path.join(entry.parentPath, entry.name))
		.filter((file) => !/(^|[\\/])(test|e2e)[\\/]/.test(path.relative(dir, file)));
}

/** @param {string} code @param {string} tag */
const carries = (code, tag) =>
	['"', "'", '`'].some((quote) => code.includes(`${quote}${tag}${quote}`));

// ── The page ─────────────────────────────────────────────────────────────────

/** A page importing the editor, with the package linked the way an install puts it. It imports
 *  `configureEditorEnv` too, so a bundler can't prove the switch stays off without the swap. */
function writePage(/** @type {string} */ page, /** @type {string} */ packageRoot) {
	const scope = path.join(page, 'node_modules/@voithos-labs');
	mkdirSync(scope, { recursive: true });
	symlinkSync(packageRoot, path.join(scope, 'aragonite'), 'junction');
	const html = '<!doctype html><script type="module" src="./main.js"></script>';
	const main = [
		"import { createEditor } from '@voithos-labs/aragonite';",
		"import { configureEditorEnv } from '@voithos-labs/aragonite/testing';",
		'window.editorApi = { createEditor, configureEditorEnv };'
	].join('\n');
	writeFileSync(path.join(page, 'index.html'), html);
	writeFileSync(path.join(page, 'main.js'), main);
	writeFileSync(path.join(page, 'package.json'), '{ "type": "module" }');
}

/**
 * @param {string} page
 * @param {'svelte' | 'prebuilt'} route The Svelte plugin makes Vite resolve the `svelte` condition.
 * @param {'development' | 'production'} mode
 */
async function buildPage(page, route, mode) {
	const outDir = path.join(page, `out-${route}-${mode}`);
	const previous = process.env.NODE_ENV;
	// Vite picks the `development` or `production` export condition from NODE_ENV.
	process.env.NODE_ENV = mode;
	try {
		await build({
			root: page,
			configFile: false,
			logLevel: 'silent',
			mode,
			plugins: route === 'svelte' ? [svelte({ configFile: false })] : [],
			build: { outDir, emptyOutDir: true, minify: mode === 'production' }
		});
	} finally {
		process.env.NODE_ENV = previous;
	}
	const scripts = readdirSync(outDir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
		.map((entry) => readFileSync(path.join(entry.parentPath, entry.name)));
	return {
		code: scripts.map((bytes) => bytes.toString('utf8')).join('\n'),
		gzipped: scripts.reduce((sum, bytes) => sum + gzipSync(bytes, { level: 9 }).length, 0)
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const failures = await verifyDevStrip(process.argv[2]);
	if (failures.length > 0) {
		console.error('verify-dev-strip:\n  ' + failures.join('\n  '));
		process.exit(1);
	}
}
