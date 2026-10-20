/**
 * Where the reader is in reading mode, which has no caret: the editor's one tab stop (the block
 * whose own element last took focus, else the first on screen; every other block sits at -1), the
 * caret a click leaves, cleared, and where focus and the click were, for leaving reading mode.
 * The editing modes keep every block at 0. `docs/design/editor.md` § Browser engines.
 */

import { tick } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { assertInvariant } from '../../assert';
import { checkReadingTabStops } from '../../invariants/reading-tab-stops';
import { rawOffsetAt } from '../../caret/widget-offset';
import type { BlockElLookup } from '../../caret/block-el-lookup';
import { findSurfacePathForElement } from '../../selection/path-lookup';
import { readNativeSelection } from '../../selection/native-bridge';
import { onRoot, removeAll } from './listeners';

export interface ReadingFocus {
	/** Keeps `el`'s tabindex and moves the stop to it when it takes focus itself (a widget inside
	 *  it doesn't count). Returns the release; one call per element. */
	hold(el: HTMLElement, getPath: () => readonly number[]): () => void;
	/** A still click: notes the point its caret marks, then drops the caret, so every engine starts
	 *  Tab from the focused block. A drag's or a double click's range stays. */
	noteClick(): void;
	/** Where leaving reading mode puts the caret, and forgets it: after a focused widget, at a
	 *  selection's focus or the clicked point in the focused block, else at its start. */
	takeExitCaret(): ReadingCaret | null;
	/** Hears focus moving inside `root`, and checks in a dev build that one block is a tab stop. */
	install(root: HTMLElement): () => void;
}

export interface ReadingCaret {
	path: number[];
	offset: number;
}

export interface ReadingFocusDeps {
	isReading(): boolean;
	/** Whether the mounted block at `path` shows in the editor's viewport. */
	isInView(path: readonly number[]): boolean;
	getBlockElByPath: BlockElLookup;
	isHostChrome(node: Node | null): boolean;
	/** Drops the browser's selection through the editor's one writer of it. */
	clearSelection(): void;
}

export function createReadingFocus(deps: ReadingFocusDeps): ReadingFocus {
	let stop = $state<string | null>(null);
	// The blocks mounted while reading, so a stop that windowed out falls back to one on screen.
	const mounted = new SvelteMap<HTMLElement, readonly number[]>();
	// What last took focus in the editor while reading: a jump's target, a Tab stop, a click.
	let focused: Element | null = null;
	let clicked: { contentEl: HTMLElement; offset: number } | null = null;

	// Read again as blocks mount and unmount, which a scroll far enough to need a fallback does.
	const effectiveStop = $derived.by((): string | null => {
		const paths = [...mounted.values()];
		if (paths.some((path) => keyOf(path) === stop)) return stop;
		paths.sort(comparePaths);
		const fallback = paths.find((path) => deps.isInView(path)) ?? paths[0];
		return fallback ? keyOf(fallback) : null;
	});

	/** The block surface holding `node`, with its path; null outside every block. */
	function surfaceOf(node: Node): { path: number[]; contentEl: HTMLElement } | null {
		const el = node instanceof Element ? node : node.parentElement;
		const path = el && findSurfacePathForElement(el);
		const contentEl = path && deps.getBlockElByPath(path);
		return path && contentEl?.contains(node) ? { path, contentEl } : null;
	}

	function exitCaret(): ReadingCaret | null {
		const el = focused;
		if (!el?.isConnected) return null;
		const surface = surfaceOf(el);
		if (!surface) return null;
		const { path, contentEl } = surface;
		const widgetEnd = el.closest('[data-inline-widget]')?.getAttribute('data-source-end');
		if (widgetEnd) return { path, offset: Number(widgetEnd) };
		const focus = readNativeSelection()?.focus;
		if (focus && contentEl.contains(focus.node))
			return { path, offset: rawOffsetAt(contentEl, focus.node, focus.offset) };
		if (clicked?.contentEl === contentEl) return { path, offset: clicked.offset };
		return { path, offset: 0 };
	}

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
		noteClick() {
			const sel = readNativeSelection();
			if (!deps.isReading() || !sel?.collapsed) return;
			const surface = surfaceOf(sel.focus.node);
			if (!surface) return;
			clicked = {
				contentEl: surface.contentEl,
				offset: rawOffsetAt(surface.contentEl, sel.focus.node, sel.focus.offset)
			};
			deps.clearSelection();
			// A focus walk can still start where the press went down (WebKit's does); moving focus
			// off the block and back puts the start on the block itself.
			const active = document.activeElement;
			if (active instanceof HTMLElement && surface.contentEl.contains(active)) {
				active.blur();
				active.focus({ preventScroll: true });
			}
		},
		takeExitCaret() {
			const caret = exitCaret();
			focused = null;
			clicked = null;
			return caret;
		},
		install(root) {
			const checks = $effect.root(() => {
				$effect(() => {
					if (!deps.isReading()) return;
					void effectiveStop;
					void tick().then(() =>
						assertInvariant('reading-tab-stops', () => checkReadingTabStops(root))
					);
				});
			});
			return removeAll(
				checks,
				onRoot(root, 'focusin', (e: FocusEvent) => {
					const target = e.target;
					if (!deps.isReading() || !(target instanceof Element)) return;
					if (!deps.isHostChrome(target)) focused = target;
				})
			);
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
