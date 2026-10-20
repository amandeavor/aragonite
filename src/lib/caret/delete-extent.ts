/**
 * What a collapsed delete inside a line takes, decided by the editor so every engine takes the
 * same bytes: an emoji and a CRLF line ending go whole either way, and Backspace takes only the
 * last code point of any other cluster, so an accent or an Indic vowel sign comes off on its own.
 * Each answer reads a fixed window around the caret, never the whole block.
 */

import { graphemeSegmenter } from '../core/text-units';
import { recordDeleteWindow } from '../perf/instruments';

export type DeleteDirection = 'backward' | 'forward';

export interface DeleteSpan {
	start: number;
	end: number;
}

/** The delete inputs the editor writes itself, each with the side of the caret it takes from. */
export const DECIDED_DELETES: Readonly<Record<string, DeleteDirection>> = {
	deleteContentBackward: 'backward',
	deleteContentForward: 'forward'
};

/** The delete inputs left to the browser and read back on `input`: the word and line units the
 *  editor has no rule for yet, and the ones that are another gesture's (a cut, a drag, an IME). */
export const DECLINED_DELETES: ReadonlySet<string> = new Set([
	'deleteWordBackward',
	'deleteWordForward',
	'deleteSoftLineBackward',
	'deleteSoftLineForward',
	'deleteHardLineBackward',
	'deleteHardLineForward',
	'deleteEntireSoftLine',
	'deleteContent',
	'deleteByCut',
	'deleteByDrag',
	'deleteCompositionText'
]);

/** The side a delete input takes from when the editor decides it; null for every other input. */
export function decidedDeleteDirection(inputType: string): DeleteDirection | null {
	return Object.hasOwn(DECIDED_DELETES, inputType) ? DECIDED_DELETES[inputType] : null;
}

/** Why a delete the editor decides went to the browser after all, read back on `input` instead.
 *  The editor's own check (G1.132) accepts an undecided delete only with one of these. */
export type DeleteDecline =
	'claimed' | 'composing' | 'not-cancelable' | 'range' | 'no-caret' | 'wide-keyless' | 'surface';

export type DeleteVerdict = { decided: true } | { decided: false; decline: DeleteDecline };

/** Wide enough for the longest emoji sequences (a tag flag is 14 code units); a cluster longer
 *  than this goes in window-sized parts. */
export const DELETE_WINDOW = 64;

/** The character a delete at `caret` takes in `text`, kept inside `bounds`; null at the bound the
 *  delete faces, where there is nothing in the line to take. */
export function characterExtent(
	text: string,
	caret: number,
	direction: DeleteDirection,
	bounds: DeleteSpan
): DeleteSpan | null {
	if (direction === 'backward') {
		if (caret <= bounds.start) return null;
		const window = text.slice(Math.max(bounds.start, caret - DELETE_WINDOW), caret);
		recordDeleteWindow(window.length);
		return { start: caret - backwardUnit(lastCluster(window)).length, end: caret };
	}
	if (caret >= bounds.end) return null;
	const window = text.slice(caret, Math.min(bounds.end, caret + DELETE_WINDOW));
	recordDeleteWindow(window.length);
	return { start: caret, end: caret + firstCluster(window).length };
}

// ── Clusters ─────────────────────────────────────────────────────────────────

// A keycap is a digit, VS16 and U+20E3; a skin tone is a modifier; a flag is two regional indicators.
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|⃣|️/u;

function backwardUnit(cluster: string): string {
	if (cluster === '\r\n' || EMOJI.test(cluster)) return cluster;
	return Array.from(cluster).at(-1) ?? cluster;
}

function lastCluster(window: string): string {
	const segmenter = graphemeSegmenter();
	if (!segmenter) return Array.from(window).at(-1) ?? window;
	return segmenter.segment(window).containing(window.length - 1)?.segment ?? window;
}

function firstCluster(window: string): string {
	const segmenter = graphemeSegmenter();
	if (!segmenter) return Array.from(window)[0] ?? window;
	return segmenter.segment(window).containing(0)?.segment ?? window;
}
