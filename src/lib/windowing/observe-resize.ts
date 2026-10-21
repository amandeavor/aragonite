/**
 * Every ResizeObserver in the editor is made here (G4.240), so the browser's size-report quirks
 * are handled once. An element first observed while the browser delivers reports is skipped at
 * its depth and reported as a loop error, so a watcher that can start then waits a frame.
 */

/** Watches `el` from the next frame on, for a component that can mount during a delivery; the
 *  first report still carries the size as of that frame. Returns the disposer. */
export function observeResize(el: Element, onResize: ResizeObserverCallback): () => void {
	// jsdom has no ResizeObserver; callers keep their other measuring paths there.
	if (typeof ResizeObserver !== 'function') return () => {};
	const observer = new ResizeObserver(onResize);
	const frame = requestAnimationFrame(() => observer.observe(el));
	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
	};
}

/** Watches `el` from now on, for a watcher set up outside a delivery (an editor-level one at
 *  mount); one that can start during a delivery uses `observeResize`. Returns the disposer. */
export function observeResizeNow(el: Element, onResize: ResizeObserverCallback): () => void {
	if (typeof ResizeObserver !== 'function') return () => {};
	const observer = new ResizeObserver(onResize);
	observer.observe(el);
	return () => observer.disconnect();
}

export interface SharedResizeWatch {
	/** Watches `el` from the next frame on; returns the disposer. */
	watch(el: Element, onResize: (entry: ResizeObserverEntry) => void): () => void;
}

/** One observer for many elements, each watched from the next frame, made after the width watcher.
 *  Every watcher of an element hears each resize; the last one to stop unobserves it. */
export function createSharedResizeWatch(): SharedResizeWatch {
	const listeners = new Map<Element, Set<(entry: ResizeObserverEntry) => void>>();
	let observer: ResizeObserver | null = null;
	const deliver: ResizeObserverCallback = (entries) => {
		for (const entry of entries) {
			for (const onResize of [...(listeners.get(entry.target) ?? [])]) onResize(entry);
		}
	};
	return {
		watch(el, onResize) {
			if (typeof ResizeObserver !== 'function') return () => {};
			const watchers = listeners.get(el) ?? new Set();
			listeners.set(el, watchers);
			// A fresh function per watch, so the same callback watching twice stops one at a time.
			const watcher = (entry: ResizeObserverEntry) => onResize(entry);
			watchers.add(watcher);
			const frame = requestAnimationFrame(() => {
				observer ??= new ResizeObserver(deliver);
				observer.observe(el);
			});
			return () => {
				cancelAnimationFrame(frame);
				watchers.delete(watcher);
				if (watchers.size > 0 || listeners.get(el) !== watchers) return;
				listeners.delete(el);
				observer?.unobserve(el);
			};
		}
	};
}
