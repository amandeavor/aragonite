// The failures the exhaustive suites already know about, one per line in `known-failures.txt`,
// each a defect waiting on its fix. A suite fails on a failure the file doesn't list and on a
// listed one, within the lengths it ran, that now passes. `EXHAUSTIVE_BLESS=1` rewrites the file.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import { LISTED_FAILURES } from './alphabet';

const LEDGER = 'src/lib/test/exhaustive/known-failures.txt';

/** A failure line opens with its input as a JSON string. */
const inputOf = (failure: string) => JSON.parse(/^"(?:[^"\\]|\\.)*"/.exec(failure)![0]) as string;

/** Holds `failures`, from every input up to `maxLength` long, to the lines under `suite`. */
export function holdToKnownFailures(suite: string, failures: string[], maxLength: number): void {
	const lines = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean) : [];
	const prefix = `${suite}\t`;
	const known = lines.filter((line) => line.startsWith(prefix)).map((l) => l.slice(prefix.length));
	const inRun = known.filter((failure) => inputOf(failure).length <= maxLength);
	if (process.env.EXHAUSTIVE_BLESS === '1') {
		const kept = lines.filter(
			(line) => !line.startsWith(prefix) || !inRun.includes(line.slice(prefix.length))
		);
		const written = [...kept, ...failures.map((failure) => prefix + failure)].sort();
		writeFileSync(LEDGER, [...new Set(written)].join('\n') + '\n');
		return;
	}
	const added = failures.filter((failure) => !known.includes(failure));
	const fixed = inRun.filter((failure) => !failures.includes(failure));
	expect(
		{ added: added.slice(0, LISTED_FAILURES), fixed: fixed.slice(0, LISTED_FAILURES) },
		`${added.length} new, ${fixed.length} now passing; once intended, EXHAUSTIVE_BLESS=1 rewrites ${LEDGER}`
	).toEqual({ added: [], fixed: [] });
}
