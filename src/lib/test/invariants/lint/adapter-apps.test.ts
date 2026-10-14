/**
 * Every framework example runs in the adapter suite (G4.187): an app under `examples/` with no
 * `APPS` entry would never be built, installed from the tarballs or tested, and a spec no app
 * names would never run.
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { collectFiles } from './scan-source';
import { SOURCE_DIR } from './source-paths';
import { APPS } from '../../../../../examples/adapter-suite/apps.mjs';

// The Svelte smoke app has its own script.
const NOT_FRAMEWORK_APPS = ['consumer'];
const BUILDS = ['node_modules', 'dist', '.next', '.nuxt', '.output'];

const LISTED = new Set(Object.values(APPS).map((app) => path.basename(app.cwd)));
const NAMED_SPECS = new Set(Object.values(APPS).flatMap((app) => app.specs));

describe('adapter suite coverage', () => {
	const apps = collectFiles(SOURCE_DIR.examples, { extensions: ['package.json'], skip: BUILDS })
		.map((file) => file.split('/'))
		.filter((parts) => parts.length === 3 && !NOT_FRAMEWORK_APPS.includes(parts[1]))
		.map((parts) => parts[1]);
	const specs = collectFiles(SOURCE_DIR.adapterSuiteTests, { extensions: ['.spec.ts'] }).map(
		(file) => path.posix.basename(file, '.spec.ts')
	);

	it('lists every framework app under examples/', () => {
		expect(apps.length).toBeGreaterThan(0);
		expect(apps.filter((app) => !LISTED.has(app))).toEqual([]);
	});

	it('runs every spec file for at least one app', () => {
		expect(specs.length).toBeGreaterThan(0);
		expect(specs.filter((spec) => !NAMED_SPECS.has(spec))).toEqual([]);
	});
});
