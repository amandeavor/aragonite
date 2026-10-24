// How a behavior row writes what an input did, and the check that holds a suite's rows to the
// committed baseline. With `BEHAVIOR_RECORD` set to a folder, a suite writes its rows there
// instead of checking them, which is how `scripts/behavior.mjs` records a checkout.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { EditorSelection } from '#lib/selection/primitives.js';
import {
	BASELINE_PATH,
	diffRows,
	formatDiff,
	formatRows,
	parseRows,
	type Row
} from '../../../../scripts/behavior-rows.mjs';

export type { Row };

/** Longer text is stored as a hash and an excerpt, which keeps the baseline file small. */
const VERBATIM_LIMIT = 100;
const EXCERPT_BEFORE = 16;
const EXCERPT_AFTER = 24;

/** `text` verbatim when short; else its hash, where it first differs from `input`, and the text
 *  around that spot, so a changed row still shows roughly what moved. */
export function textField(input: string, text: string): string {
	if (text.length <= VERBATIM_LIMIT) return text;
	let at = 0;
	while (at < text.length && text[at] === input[at]) at++;
	const from = Math.max(0, at - EXCERPT_BEFORE);
	const hash = createHash('sha1').update(text).digest('hex').slice(0, 12);
	return `#${hash} @${at} ${JSON.stringify(text.slice(from, at + EXCERPT_AFTER))}`;
}

/** A selection as `path:offset`, a range as `anchor..focus`; a table cell point is marked `c`. */
export function caretField(selection: EditorSelection | null): string {
	if (!selection) return 'none';
	const point = ({ path, offset, cellCoordinate }: EditorSelection['anchor']) =>
		`${path.join('.')}:${cellCoordinate ? 'c' : ''}${offset}`;
	const anchor = point(selection.anchor);
	const focus = point(selection.focus);
	return anchor === focus ? anchor : `${anchor}..${focus}`;
}

/** Left out when undo gives back the input and redo the edit, the common case; else what each
 *  gave. */
export function undoField(
	input: string,
	edited: string,
	undone: string,
	redone: string
): string | undefined {
	if (undone === input && redone === edited) return undefined;
	return `undo ${textField(input, undone)} | redo ${textField(input, redone)}`;
}

/** Each dev warning's tag once, sorted, so the order a check fires in doesn't move a row. */
export function warnsField(tags: readonly string[]): string[] {
	return [...new Set(tags)].sort();
}

/** Fails, listing every changed input, when `rows` differ from the baseline rows under `prefix`;
 *  writes them out instead under `BEHAVIOR_RECORD`. */
export function holdRowsToBaseline(prefix: string, rows: Row[]): void {
	for (const row of rows) {
		if (!row.in.startsWith(`${prefix} `)) throw new Error(`row ${row.in} is outside ${prefix}`);
	}
	const recordTo = process.env.BEHAVIOR_RECORD;
	if (recordTo) {
		mkdirSync(recordTo, { recursive: true });
		writeFileSync(`${recordTo}/${prefix.replace(/\W+/g, '-')}.jsonl`, formatRows(rows));
		return;
	}
	const committed = existsSync(BASELINE_PATH) ? parseRows(readFileSync(BASELINE_PATH, 'utf8')) : [];
	const base = committed.filter((row) => row.in.startsWith(`${prefix} `));
	const diff = diffRows(base, rows);
	const moved = diff.changed.length + diff.added.length + diff.removed.length;
	expect(
		moved,
		`${formatDiff(`behavior ${prefix} against ${BASELINE_PATH}`, diff, 20)}\n` +
			'An intended change: `npm run behavior:bless`, and commit the baseline with it.'
	).toBe(0);
}
