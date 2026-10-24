#!/usr/bin/env node
// The behavior differential: runs the behavior suites over this checkout in record mode, then
// lists every input whose bytes, caret, undo result or dev warnings differ from a baseline.
// The baseline is the committed file, the file as committed at `--against <ref>`, or a record
// file given as `--against <path>`; `--against` never runs the ref's code. `--record <path>`
// writes this checkout's rows, `--bless` writes them over the committed baseline, `--from <path>`
// diffs a record instead of running the suites, `--json` prints the diff as JSON.
import { execFileSync, spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { BASELINE_PATH, diffRows, formatDiff, formatRows, parseRows } from './behavior-rows.mjs';

const SUITES = 'src/lib/test/behavior';
const VITEST = join(
	dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
	'vitest.mjs'
);
const RESULTS = 'behavior-results/diff.txt';
const REPORT_LIMIT = 20;

const args = process.argv.slice(2);
const valueOf = (/** @type {string} */ flag) => {
	const at = args.indexOf(flag);
	return at === -1 ? null : args[at + 1];
};

const started = Date.now();
const from = valueOf('--from');
const tip = parseRows(from ? readFileSync(from, 'utf8') : recordCheckout());
const seconds = Math.round((Date.now() - started) / 1000);

const record = valueOf('--record');
if (record) writeFileSync(record, formatRows(tip));
if (args.includes('--bless')) {
	writeFileSync(BASELINE_PATH, formatRows(tip));
	console.log(`behavior: blessed ${tip.length} rows into ${BASELINE_PATH} (${seconds} s)`);
	process.exit(0);
}

const against = valueOf('--against');
const diff = diffRows(parseRows(baselineText(against)), tip);
if (args.includes('--json')) {
	console.log(JSON.stringify(diff, null, '\t'));
} else {
	const label = `behavior --against ${against ?? BASELINE_PATH}`;
	mkdirSync('behavior-results', { recursive: true });
	writeFileSync(RESULTS, formatDiff(label, diff) + '\n');
	console.log(`${formatDiff(label, diff, REPORT_LIMIT)}\n(${seconds} s; full list in ${RESULTS})`);
}

/** Every behavior suite's rows over this checkout, as baseline text. */
function recordCheckout() {
	const folder = mkdtempSync(join(tmpdir(), 'behavior-'));
	try {
		const result = spawnSync(process.execPath, [VITEST, 'run', SUITES, '--maxWorkers=4'], {
			stdio: ['ignore', 'ignore', 'inherit'],
			env: { ...process.env, BEHAVIOR_RECORD: folder }
		});
		if (result.status !== 0) throw new Error(`behavior: the suites failed in ${SUITES}`);
		const files = readdirSync(folder).filter((file) => file.endsWith('.jsonl'));
		if (files.length === 0) throw new Error(`behavior: ${SUITES} recorded no rows`);
		return files.map((file) => readFileSync(join(folder, file), 'utf8')).join('');
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

/** @param {string | null} against */
function baselineText(against) {
	if (against === null) return readFileSync(BASELINE_PATH, 'utf8');
	if (existsSync(against)) return readFileSync(against, 'utf8');
	try {
		return execFileSync('git', ['show', `${against}:${BASELINE_PATH}`], {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'ignore']
		});
	} catch {
		console.error(`behavior: ${against} has no ${BASELINE_PATH}; every row reads as added`);
		return '';
	}
}
