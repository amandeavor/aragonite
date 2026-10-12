/**
 * Pending marks: the inline formats a toggle at a collapsed caret promises the next insertion in its
 * block, whatever route writes it (live-mode.md § 4.3). Live mode paints no delimiter, so an empty
 * pair in the bytes would be invisible residue on an abandoned toggle; the block marks the insertion
 * instead, wrapping a kind the caret lacks and escaping one it carries.
 */

import type { InlineMarkKind } from '../schema/inline-construct-policy';
import { insertionStart, type InsertionRecord } from './next-insertion';

export interface PendingMarks extends InsertionRecord {
	/** One block's view; `block` is the identity its writes take the marks with. */
	forBlock(block: object): BlockPendingMarks;
}

export interface BlockPendingMarks {
	/** A toggle chord at a collapsed caret here. The same chord twice pends nothing again. */
	toggle(kind: InlineMarkKind): void;
}

export function createPendingMarks(): PendingMarks {
	let held: { block: object; marks: ReadonlySet<InlineMarkKind> } | null = null;

	return {
		forBlock: (block) => ({
			toggle: (kind) => {
				const marks = flipMark(held?.block === block ? held.marks : null, kind);
				held = marks && { block, marks };
			}
		}),
		take: (block) => {
			const taken = held?.block === block ? held : null;
			if (!taken) return null;
			return {
				at: null,
				// Spent by the insertion whether or not the block finds bytes that read back marked: it
				// was the one insertion the marks were promised to.
				apply: (before, edit, placement) => {
					const at = insertionStart(before, edit);
					if (at === null || !placement) return null;
					const marked = placement.mark(before, edit, at, taken.marks, placement.side);
					return marked && { ...marked, inPlace: true };
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

/** The set one toggle chord produces, or null once it empties. Pure, so the toggle matrix is
 *  testable without an instance. */
export function flipMark(
	marks: ReadonlySet<InlineMarkKind> | null,
	kind: InlineMarkKind
): ReadonlySet<InlineMarkKind> | null {
	const next = new Set(marks ?? []);
	if (!next.delete(kind)) next.add(kind);
	return next.size > 0 ? next : null;
}
