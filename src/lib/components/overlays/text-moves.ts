/**
 * Tells the overlays when text inside a block may have moved while the block's box stayed the same
 * size, which no resize observer sees: markers hidden or shown by a mode, a focus or the caret, a
 * theme, a font or an image finishing loading. Whatever makes such a change reports it here, and
 * each affected overlay measures once, a tick later, against the rendered result.
 */

import { tick } from 'svelte';

export interface TextMoves {
	/** Calls `measure` after text inside `host`, or inside a block it holds, may have moved;
	 *  returns the disposer. */
	watch(host: HTMLElement, measure: () => void): () => void;
	/** Text in the block holding `el` may have moved. Blocks inside that one and the containers
	 *  around it measure too, since their overlays cover the same text. */
	movedWithin(el: Element): void;
	/** Text in every block may have moved. */
	movedEverywhere(): void;
	/** Reports the image and font loads under `root`; returns the disposer. */
	install(root: HTMLElement): () => void;
}

interface Watcher {
	host: HTMLElement;
	measure: () => void;
}

export function createTextMoves(): TextMoves {
	const watchers = new Set<Watcher>();
	const due = new Set<Watcher>();
	let flushQueued = false;

	// After the tick, so the measure reads the rendered result and never writes overlay state
	// from inside a teardown (a focusout during a structural commit).
	function queue(watcher: Watcher): void {
		due.add(watcher);
		if (flushQueued) return;
		flushQueued = true;
		void tick().then(() => {
			flushQueued = false;
			const run = [...due];
			due.clear();
			for (const w of run) if (watchers.has(w)) w.measure();
		});
	}

	function movedWithin(el: Element): void {
		const block = el.closest<HTMLElement>('[data-block-path]') ?? el;
		for (const w of watchers) {
			if (block.contains(w.host) || w.host.contains(block)) queue(w);
		}
	}

	function movedEverywhere(): void {
		for (const w of watchers) queue(w);
	}

	return {
		watch(host, measure) {
			const watcher = { host, measure };
			watchers.add(watcher);
			return () => {
				watchers.delete(watcher);
				due.delete(watcher);
			};
		},
		movedWithin,
		movedEverywhere,
		install(root) {
			// Neither event bubbles, so the root listens in the capture phase.
			const onImage = (e: Event) => {
				if (e.target instanceof HTMLImageElement) movedWithin(e.target);
			};
			root.addEventListener('load', onImage, true);
			root.addEventListener('error', onImage, true);
			// jsdom has no font set.
			const fonts = root.ownerDocument.fonts as FontFaceSet | undefined;
			fonts?.addEventListener('loadingdone', movedEverywhere);
			return () => {
				root.removeEventListener('load', onImage, true);
				root.removeEventListener('error', onImage, true);
				fonts?.removeEventListener('loadingdone', movedEverywhere);
			};
		}
	};
}
