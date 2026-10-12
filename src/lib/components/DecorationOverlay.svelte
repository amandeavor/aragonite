<script lang="ts">
	import { getContext } from 'svelte';
	import type { BlockComponent } from '../block-component';
	import {
		EDITOR_DOC_KEY,
		EDITOR_SERVICES_KEY,
		type EditorDoc,
		type EditorServices
	} from '../editor-keys';
	import type { MarkDecoration } from '../decorations/types';
	import { collapseCellMarks, type IndexedDecoration } from '../decorations/buckets';
	import {
		lineGapReach,
		paintOrder,
		winningMark,
		type HitReach
	} from '../decorations/mark-interactions';
	import { wireOverlayRemeasure } from '../caret/overlay-remeasure';

	let {
		path,
		blockRef,
		blockEl,
		isContainer = false,
		containerPaintsRects = false
	}: {
		path: number[];
		blockRef: BlockComponent | undefined;
		blockEl: HTMLElement | null | undefined;
		/** Containers paint nothing, since their children paint themselves, except grids:
		 *  their cells have no BlockHost of their own, so whole-cell marks paint here. */
		isContainer?: boolean;
		/** Decided at BlockHost, which hands the same value to SelectionOverlay. */
		containerPaintsRects?: boolean;
	} = $props();

	const services = getContext<EditorServices | undefined>(EDITOR_SERVICES_KEY);
	const engine = services?.decorations;
	// Optional for the same reason `services` is: a mount without the editor shell has none.
	const getEditorRoot = getContext<EditorDoc | undefined>(EDITOR_DOC_KEY)?.editorRoot;

	// A grid supplies cellRect, so marks on its cells, which have no BlockHost overlay
	// of their own, paint as whole cells here.
	const containerPaintsCells = $derived(isContainer && !!blockRef?.cellRect);

	interface Painted {
		left: number;
		top: number;
		width: number;
		height: number;
		cls: string;
		attrs?: Record<string, string>;
		clickMark?: MarkDecoration;
		hoverMark?: MarkDecoration;
		reach?: HitReach;
	}
	let rects = $state.raw<Painted[]>([]);
	// Rendered keyed by index, so an element keeps its index for as long as it lives.
	const rectIndex = new WeakMap<Element, number>();

	// The hover tracker's key for this overlay, so unmounting it ends a hover it began.
	const owner = {};
	$effect(() => () => engine?.markHover.release(owner));

	function click(r: Painted, ev: MouseEvent): void {
		const mark = r.clickMark;
		if (mark) engine?.runMarkHandler(mark, () => mark.interactive?.onClick?.(mark, ev));
	}

	function enter(i: number): void {
		const mark = rects[i]?.hoverMark;
		if (!mark || !blockEl || !engine) return;
		const origin = blockEl.getBoundingClientRect();
		const toViewport = (r: Painted) =>
			new DOMRect(origin.left + r.left, origin.top + r.top, r.width, r.height);
		const own = rects.filter((r) => r.hoverMark === mark).map(toViewport);
		engine.markHover.enter(owner, mark, { anchor: toViewport(rects[i]), rects: own });
	}

	// Moving onto another rect of the same mark is not a leave.
	function leave(i: number, ev: PointerEvent): void {
		const mark = rects[i]?.hoverMark;
		const to = (ev.relatedTarget as Element | null)?.closest?.('.decoration-overlay');
		const j = to ? rectIndex.get(to) : undefined;
		if (mark && j !== undefined && rects[j]?.hoverMark === mark) return;
		engine?.markHover.release(owner);
	}

	$effect(() => {
		const eng = engine,
			ref = blockRef,
			el = blockEl;
		// Read up front so the effect depends on the decoration set: `sourceCount` is a plain
		// counter, and a source added after mount would never re-run it.
		const marks = eng
			? containerPaintsCells
				? eng.marksForDescendants(path)
				: eng.marksForPath(path)
			: [];
		if (!eng || eng.sourceCount === 0 || !el) {
			rects = [];
			return;
		}
		if (isContainer && !containerPaintsCells && !containerPaintsRects) {
			rects = [];
			return;
		}

		function measure(): void {
			if (!el) return;
			const blockRect = el.getBoundingClientRect();
			rects = containerPaintsCells
				? measureCells(marks, blockRect)
				: measureLeaf(marks, ref, blockRect);
		}

		function measureLeaf(
			leafMarks: IndexedDecoration<MarkDecoration>[],
			leaf: BlockComponent | undefined,
			blockRect: DOMRect
		): Painted[] {
			if (!leaf?.measurePartialRects) return [];
			const out: Painted[] = [];
			for (const { dec } of paintOrder(leafMarks)) {
				const first = out.length;
				for (const r of leaf.measurePartialRects(dec.start, dec.end)) {
					// A collapsed range still emits a degenerate zero-width rect at a line
					// boundary, which would paint an invisible sliver.
					if (r.width <= 0) continue;
					out.push({ ...toLocal(r, blockRect, dec.class, dec.attrs), ...handlersOf(dec) });
				}
				if (dec.interactive?.onHover) {
					const own = out.slice(first);
					lineGapReach(own).forEach((reach, k) => (own[k].reach = reach));
				}
			}
			return out;
		}

		// Several marks in one cell collapse to a single rect whose class is their union; the
		// precedence rule names which of them answers a click and a hover.
		function measureCells(
			descMarks: IndexedDecoration<MarkDecoration>[],
			blockRect: DOMRect
		): Painted[] {
			if (!ref?.cellRect) return [];
			const out: Painted[] = [];
			for (const cell of collapseCellMarks(descMarks, path.length)) {
				const r = ref.cellRect(cell.rowIdx, cell.colIdx);
				if (!r) continue;
				out.push({
					...toLocal(r, blockRect, cell.class, cell.dec.attrs),
					clickMark: winningMark(cell.marks, (d) => !!d.interactive?.onClick)?.dec,
					hoverMark: winningMark(cell.marks, (d) => !!d.interactive?.onHover)?.dec
				});
			}
			return out;
		}

		function toLocal(
			r: DOMRect,
			blockRect: DOMRect,
			cls: string,
			attrs: Record<string, string> | undefined
		): Painted {
			return {
				left: r.left - blockRect.left,
				top: r.top - blockRect.top,
				width: r.width,
				height: r.height,
				cls,
				attrs
			};
		}

		function handlersOf(dec: MarkDecoration): Pick<Painted, 'clickMark' | 'hoverMark'> {
			return {
				clickMark: dec.interactive?.onClick ? dec : undefined,
				hoverMark: dec.interactive?.onHover ? dec : undefined
			};
		}

		const editorRoot = getEditorRoot?.() ?? null;
		return wireOverlayRemeasure({ el, editorRoot, blockRef: ref, measure });
	});
</script>

{#each rects as r, i (i)}
	<div
		{...r.attrs}
		{@attach (el) => void rectIndex.set(el, i)}
		class="decoration-overlay {r.cls}"
		class:decoration-overlay-interactive={!!(r.clickMark || r.hoverMark)}
		contenteditable="false"
		style="left:{r.left}px;top:{r.top}px;width:{r.width}px;height:{r.height}px;"
		onclick={r.clickMark ? (ev) => click(r, ev) : undefined}
		onpointerenter={r.hoverMark ? () => enter(i) : undefined}
		onpointerleave={r.hoverMark ? (ev) => leave(i, ev) : undefined}
	>
		{#if r.reach && (r.reach.above || r.reach.below)}
			<span
				class="decoration-overlay-reach"
				style="top:{-r.reach.above}px;bottom:{-r.reach.below}px;"
			></span>
		{/if}
	</div>
{/each}
