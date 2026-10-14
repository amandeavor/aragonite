// Packs the library and gates the tarball: every published path must be present, and no
// test/e2e/spec file may ship. Run after `npm run package`. REQUIRED is derived from
// package.json `exports` (pack-manifest.mjs), not hand-maintained, so a new plugin subpath
// can't be published-but-unbuilt without this failing.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { collectLeafStrings, requiredPackPaths } from './pack-manifest.mjs';
import { verifyPrebuilt } from './verify-prebuilt.mjs';
import { verifyTypes } from './verify-types.mjs';

// `npm pack --json` reports files[].path relative to the package root (e.g.
// `dist/index.js`) — NOT prefixed with `package/`.
const REQUIRED = requiredPackPaths();

// Non-vacuity: a broken derivation must fail loud here, never silently green-light an
// unchecked tarball. The anchors are the two entry points every build ships.
if (
	REQUIRED.length === 0 ||
	!REQUIRED.includes('dist/index.js') ||
	!REQUIRED.includes('dist/plugin.js')
) {
	console.error(
		'verify-pack: derived REQUIRED is empty or missing anchor paths — check package.json exports'
	);
	process.exit(1);
}

/**
 * `npm pack --json` reported an array of pack results through npm 10 and switched to an
 * object keyed by package name in npm 11; both carry the same per-package `files[]`.
 * @param {string} json
 * @returns {string[]}
 */
function packedPaths(json) {
	const parsed = JSON.parse(json);
	const results = Array.isArray(parsed) ? parsed : Object.values(parsed ?? {});
	const files = results[0]?.files;
	return Array.isArray(files) ? files.map((f) => f.path) : [];
}

// --ignore-scripts: without it the `prepack` script re-fires and its stdout corrupts the
// --json output. execSync (shell) so the win32 `npm` → `npm.cmd` resolution works.
const out = execSync('npm pack --dry-run --json --ignore-scripts', { encoding: 'utf8' });
const files = packedPaths(out);

// Non-vacuity: an unreadable pack report would make every check below pass over an empty
// list. A real tarball always ships files.
if (files.length === 0) {
	console.error('verify-pack: `npm pack --json` reported no files — unrecognized output shape?');
	process.exit(1);
}

const missing = REQUIRED.filter((p) => !files.includes(p));

if (missing.length) {
	console.error('verify-pack: tarball missing required paths:\n  ' + missing.join('\n  '));
	process.exit(1);
}

const FORBIDDEN = files.filter((p) => /(^|\/)(test|e2e)\//.test(p) || /\.(test|spec)\./.test(p));
if (FORBIDDEN.length) {
	console.error(
		`verify-pack: tarball ships ${FORBIDDEN.length} test/e2e file(s), e.g.:\n  ` +
			FORBIDDEN.slice(0, 5).join('\n  ')
	);
	process.exit(1);
}

const prebuiltFailures = await verifyPrebuilt();
if (prebuiltFailures.length) {
	console.error('verify-pack: the prebuilt build fails:\n  ' + prebuiltFailures.join('\n  '));
	process.exit(1);
}

const typeFailures = verifyTypes();
if (typeFailures.length) {
	console.error(
		'verify-pack: published types reach Svelte or a stylesheet:\n  ' + typeFailures.join('\n  ')
	);
	process.exit(1);
}

const wrapperFailures = readdirSync('packages')
	.map((name) => path.join('packages', name))
	.filter((dir) => existsSync(path.join(dir, 'package.json')))
	.flatMap(verifyWrapper);
if (wrapperFailures.length) {
	console.error('verify-pack: a wrapper package fails:\n  ' + wrapperFailures.join('\n  '));
	process.exit(1);
}

console.log(
	`verify-pack: OK (${files.length} files, all ${REQUIRED.length} required paths present)`
);

/**
 * A wrapper's tarball holds every path its `exports` names, and a React wrapper's entries open
 * with `'use client'`, so a Next server component can render them. Run after the wrapper builds.
 * @param {string} dir
 * @returns {string[]}
 */
function verifyWrapper(dir) {
	const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
	const packed = packedPaths(
		execSync('npm pack --dry-run --json --ignore-scripts', { cwd: dir, encoding: 'utf8' })
	);
	/** @type {string[]} */
	const named = [];
	collectLeafStrings(pkg.exports ?? {}, named);
	const failures = named
		.map((target) => target.replace(/^\.\//, ''))
		.filter((target) => !packed.includes(target))
		.map((target) => `${pkg.name} ships no ${target}`);
	if (pkg.peerDependencies?.react) {
		for (const entry of named.filter((target) => target.endsWith('.js'))) {
			const file = path.join(dir, entry);
			if (existsSync(file) && !/^['"]use client['"]/.test(readFileSync(file, 'utf8'))) {
				failures.push(`${pkg.name}'s ${entry} doesn't open with 'use client'`);
			}
		}
	}
	return failures;
}
