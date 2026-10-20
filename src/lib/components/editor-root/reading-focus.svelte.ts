/**
 * The editor's one tab stop in reading mode, where Tab is the page's focus walk: every block's
 * focus element sits at tabindex -1 but the stop, the block whose own element last took focus
 * (else the first one on screen). The editing modes keep every block at 0, since the editor's keys
 * own Tab there. `docs/design/editor.md` § Browser engines.
 */

import { tick } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { assertInvariant } from '../../assert';
import { checkReadingTabStops } from '../../invariants/reading-tab-stops';

export interface ReadingFocus {
	/** Keeps `el`'s tabindex and moves the stop to it when it takes focus itself (a widget inside
	 *  it doesn't count). Returns the release; one call per element. */
	hold(el: HTMLElement, getPath: () => readonly number[]): () => void;
	/** Checks, in a dev build, that reading mode leaves one block in the tab order. */
	install(root: HTMLElement): () => void;
}

export interface ReadingFocusDeps {
	isReading(): boolean;
	/** Whether the mounted block at `path` shows in the editor's viewport. */
	isInView(path: readonly number[]): boolean;
}

export function createReadingFocus(deps: ReadingFocusDeps): ReadingFocus {
	let stop = $state<string | null>(null);
	// The blocks mounted while reading, so a stop that windowed out falls back to one on screen.
	const mounted = new SvelteMap<HTMLElement, readonly number[]>();

	// Read again as blocks mount and unmount, which a scroll far enough to need a fallback does.
	const effectiveStop = $derived.by((): string | null => {
		const paths = [...mounted.values()];
		if (paths.some((path) => keyOf(path) === stop)) return stop;
		paths.sort(comparePaths);
		const fallback = paths.find((path) => deps.isInView(path)) ?? paths[0];
		return fallback ? keyOf(fallback) : null;
	});

	return {
		hold(el, getPath) {
			const onFocus = () => {
				stop = keyOf(getPath());
			};
			el.addEventListener('focus', onFocus);
			const release = $effect.root(() => {
				$effect(() => {
					if (!deps.isReading()) return;
					mounted.set(el, getPath());
					return () => void mounted.delete(el);
				});
				$effect(() => {
					el.tabIndex = !deps.isReading() || effectiveStop === keyOf(getPath()) ? 0 : -1;
				});
			});
			return () => {
				el.removeEventListener('focus', onFocus);
				release();
			};
		},
		install(root) {
			return $effect.root(() => {
				$effect(() => {
					if (!deps.isReading()) return;
					void effectiveStop;
					void tick().then(() =>
						assertInvariant('reading-tab-stops', () => checkReadingTabStops(root))
					);
				});
			});
		}
	};
}

function keyOf(path: readonly number[]): string {
	return path.join('.');
}

/** Document order: a shorter path that prefixes a longer one comes first. */
function comparePaths(a: readonly number[], b: readonly number[]): number {
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return a.length - b.length;
}
