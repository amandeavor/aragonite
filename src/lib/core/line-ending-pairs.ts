/**
 * A CRLF pair edits as one character, as Chromium edits it. WebKit and Firefox stop a caret and
 * delete between the `\r` and the `\n`, so a native edit's read-back passes through
 * {@link keepLineEndingPairs} before it becomes bytes.
 */

import { writtenSpan } from './written-span';

/** Whether `before` and `after`, the bytes on either side of a position, are a CRLF pair. */
export function isLineEndingPair(before: string | undefined, after: string | undefined): boolean {
	return before === '\r' && after === '\n';
}

/** Whether `offset` sits between a `\r` and the `\n` after it. */
export function splitsLineEndingPair(text: string, offset: number): boolean {
	return isLineEndingPair(text[offset - 1], text[offset]);
}

/** The CRLF pair `offset` sits against on the side `direction` names, as `[start, end)`. */
export function lineEndingPairBeside(
	text: string,
	offset: number,
	direction: 'forward' | 'backward'
): { start: number; end: number } | null {
	const start = direction === 'forward' ? offset : offset - 2;
	return splitsLineEndingPair(text, start + 1) ? { start, end: start + 2 } : null;
}

/** `after`, read back from a native edit of `before`, with each pair it cut kept whole; `caret`, in
 *  `after`, follows. An edit's edge inside a pair moves to before it. */
export function keepLineEndingPairs(
	before: string,
	after: string,
	caret: number
): { text: string; caret: number } {
	const kept = { text: after, caret };
	if (before === after || !before.includes('\r\n')) return kept;
	const edit = editWindow(before, after);
	if (!cutsAPairAtEveryPlacement(before, after, edit)) return kept;

	const inserted = after.slice(edit.start, edit.start + edit.inserted);
	let start = edit.start;
	let end = edit.end;
	if (splitsLineEndingPair(before, start)) start--;
	if (splitsLineEndingPair(before, end)) end--;
	const text = before.slice(0, start) + inserted + before.slice(end);
	const moved =
		caret <= start
			? caret
			: caret <= edit.start + edit.inserted
				? start + Math.max(0, caret - edit.start)
				: caret + text.length - after.length;
	return { text, caret: splitsLineEndingPair(text, moved) ? moved - 1 : moved };
}

/** How many CRLF pairs, lone `\r` and lone `\n` `text` holds. */
export function lineEndingCounts(text: string): { pairs: number; loneCr: number; loneLf: number } {
	let pairs = 0;
	let loneCr = 0;
	let loneLf = 0;
	for (let i = text.indexOf('\r'); i >= 0; i = text.indexOf('\r', i + 1)) {
		if (text[i + 1] === '\n') pairs++;
		else loneCr++;
	}
	for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
		if (text[i - 1] !== '\r') loneLf++;
	}
	return { pairs, loneCr, loneLf };
}

// ── Internal ─────────────────────────────────────────────────────────────────

/** The one splice turning `before` into `after`: `before`'s `[start, end)` became `inserted`
 *  characters at `start`, placed as far right as the shared prefix reaches. */
interface EditWindow {
	start: number;
	end: number;
	inserted: number;
}

function editWindow(before: string, after: string): EditWindow {
	const span = writtenSpan(before, after);
	return { start: span.start, end: span.removedEnd, inserted: span.end - span.start };
}

/** A pure insertion or deletion slides left while the byte before it repeats the run's last byte,
 *  and every placement spells the same `after`; one that cuts no pair means nothing was split. */
function cutsAPairAtEveryPlacement(before: string, after: string, edit: EditWindow): boolean {
	const run =
		edit.inserted > 0
			? after.slice(edit.start, edit.start + edit.inserted)
			: before.slice(edit.start, edit.end);
	const slides = edit.inserted === 0 || edit.end === edit.start;
	for (let shift = 0; ; shift++) {
		const start = edit.start - shift;
		const end = edit.end - shift;
		if (!splitsLineEndingPair(before, start) && !splitsLineEndingPair(before, end)) return false;
		if (
			!slides ||
			start === 0 ||
			before[start - 1] !== run[run.length - 1 - (shift % run.length)]
		) {
			return true;
		}
	}
}
