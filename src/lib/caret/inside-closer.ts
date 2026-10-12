/**
 * The caret Edit link leaves before a URL's hidden closing bracket means inside the URL, so what is
 * typed there extends it, letter after letter, where a caret arriving any other way types past the
 * bracket (`docs/design/live-mode.md` § 4.2). A space, or a move that isn't typing there, ends it.
 */

import { insertedText, insertionStart, isSpaceRun, type InsertionRecord } from './next-insertion';

export interface InsideCloser extends InsertionRecord {
	/** One block's view; `block` is the identity its writes take the record with. */
	forBlock(block: object): InsideCloserView;
}

export interface InsideCloserView {
	/** The offset the next letter lands at, inside the URL, or null with no record here. */
	at(): number | null;
	/** The caret at `at` means inside the construct whose hidden closer starts there. */
	open(at: number): void;
}

export function createInsideCloser(): InsideCloser {
	let held: { block: object; at: number } | null = null;

	return {
		forBlock: (block) => ({
			at: () => (held?.block === block ? held.at : null),
			open: (at) => void (held = { block, at })
		}),
		take: (block) => {
			const taken = held?.block === block ? held : null;
			if (!taken) return null;
			return {
				at: taken.at,
				// Waiting where the text goes in keeps the block from moving it past the closer; the
				// record moves on with the caret, so the next letter lands inside too.
				apply: (before, edit, placement) => {
					const at = insertionStart(before, edit);
					if (at !== taken.at) return null;
					// A space ends the URL, so it ends the record and goes where the block puts it.
					if (isSpaceRun(insertedText(before, edit, at))) {
						return (placement && placement.place(before, edit, at, placement.side)) || edit;
					}
					const next = { block, at: edit.caretAfter };
					return { ...edit, kept: () => void (held = next) };
				},
				release: (waiting) => {
					if (!waiting && held === taken) held = null;
				}
			};
		},
		end: (block) => {
			if (held === null || (block !== undefined && held.block !== block)) return false;
			held = null;
			return true;
		}
	};
}
