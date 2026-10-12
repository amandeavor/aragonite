/**
 * The one hover lifecycle for an editor's marks. A hover is keyed by the decoration (its source,
 * range and place among that source's hover marks), never by a painted rect, so a repaint keeps
 * it, and every route that takes the mark away ends it exactly once.
 */

import type { MarkDecoration, MarkHover } from './types';

/** Which decoration a hover is on. The class is left out on purpose: a source restyling the
 *  hovered mark keeps the hover. */
export interface MarkIdentity {
	source: string;
	path: readonly number[];
	start: number;
	end: number;
	/** Its place among the source's hover marks over the same range. */
	ordinal: number;
}

export interface MarkHoverDeps {
	/** Null for a mark no live source offers, or one without `onHover`. */
	identify(dec: MarkDecoration): MarkIdentity | null;
	/** The mark a source offers now under this identity, if any. */
	find(id: MarkIdentity): MarkDecoration | undefined;
	/** Runs a plugin's handler, reporting a throw instead of raising it. */
	runHandler(dec: MarkDecoration, call: () => void): void;
}

/** `owner` is the overlay instance that painted the rect, so its teardown ends what it began. */
export interface MarkHoverTracker {
	enter(owner: object, dec: MarkDecoration, hover: MarkHover): void;
	/** Ends the hover `owner` began: the pointer left its rects, or the overlay unmounted. */
	release(owner: object): void;
	/** Ends the hover when no source offers its mark any more; called after every source run. */
	refresh(): void;
	end(): void;
}

export function createMarkHover(deps: MarkHoverDeps): MarkHoverTracker {
	let current: { owner: object; id: MarkIdentity; dec: MarkDecoration } | null = null;

	// Cleared before the handler runs, so a handler that invalidates its source re-enters with
	// no hover left to end twice.
	function finish(): void {
		const ended = current;
		if (!ended) return;
		current = null;
		const { dec } = ended;
		deps.runHandler(dec, () => dec.interactive?.onHover?.(dec, null));
	}

	return {
		enter(owner, dec, hover) {
			const id = deps.identify(dec);
			if (!id) return;
			if (current && sameMark(current.id, id)) {
				current.owner = owner;
				current.dec = dec;
				return;
			}
			finish();
			// Set before the handler runs: a start that throws still gets its end.
			current = { owner, id, dec };
			deps.runHandler(dec, () => dec.interactive?.onHover?.(dec, hover));
		},
		release(owner) {
			if (current?.owner === owner) finish();
		},
		refresh() {
			if (!current) return;
			const live = deps.find(current.id);
			if (live) current.dec = live;
			else finish();
		},
		end: finish
	};
}

function sameMark(a: MarkIdentity, b: MarkIdentity): boolean {
	return (
		a.source === b.source &&
		a.start === b.start &&
		a.end === b.end &&
		a.ordinal === b.ordinal &&
		a.path.length === b.path.length &&
		a.path.every((step, i) => step === b.path[i])
	);
}
