/**
 * Shared keydown prelude for contenteditable blocks: Ctrl+A counter, cross-block dispatch,
 * the caret memory's key note, undo/redo, arrow boundary navigation. Block-specific handlers
 * (Enter, Backspace, Tab, formatting) stay in each component.
 */

import type { FocusActions, HistoryActions } from '../action-contracts';
import type { DocumentGetter } from '../editor-keys';
import type { CaretMemory } from '../caret/caret-memory';
import type { CaretLanding } from './caret-landing';
import type { SelectionState } from './selection-state.svelte';
import type { CaretWriter } from '../caret/widget-offset';
import type { CrossBlockHandlers } from './cross-block/dispatch';
import type { CommandDispatchContext } from '../schema/block-commands';
import { commandAtBlock } from './cross-block/keydown';
import { holdsNativeRange } from './native-bridge';
import type { Reading } from '../schema/reading';
import {
	extendFocusToNextBlock,
	extendFocusToPreviousBlock,
	extendWithinBlock
} from './keyboard-extend';
import { getCurrentCursorEditorRelativeX } from '../caret/sticky-measure';
import {
	landableEndAbutsIsland,
	landableRawBounds,
	landableStartAbutsIsland,
	markerPrefixOf
} from '../caret/widget-offset';
import { isAtFirstVisualLine, isAtLastVisualLine } from '../caret/visual-lines';
import {
	caretEdgeKey,
	endsSelectAllRun,
	eventToChord,
	type CaretEdgeKey
} from '../schema/keybindings';
import { isDefaultGlobalChord } from '../schema/commands';

// ── Public API ─────────────────────────────────────────────────────────────

export interface SharedKeydownContext extends LandableBoundsContext {
	getEl(): HTMLElement | null;
	/** Current caret offset in raw-content coordinates (the container's marker prefix excluded). */
	getCursorOffset(): number | null;
	/** Shift-selection focus offset in raw-content coordinates (the marker prefix excluded). */
	getFocusOffset(): number | null;
	getIndex(): number;
	getMyPath(): number[];
	getDoc: DocumentGetter;
	crossBlock: CrossBlockHandlers;
	selection: SelectionState;
	caretWriter: CaretWriter;
	caretMemory: CaretMemory;
	history: HistoryActions;
	focus: FocusActions;
	/** Shows each end a Shift+Arrow moves, and restores a range folded back into one block. */
	caretLanding: Pick<CaretLanding, 'restore' | 'showSelectionEnd'>;
	/** The editor's command dispatch: the caret memory reads a chord by its current binding, and
	 *  the history suppression below takes only this editor's plugin chords. */
	commands: CommandDispatchContext;
	/** How the editor reads its bytes, whose grammar the vertical extension skips leaves by. */
	reading: Reading;
	/** A plain horizontal arrow at a hidden construct edge: true when the press moved which side
	 *  of the edge the caret means instead of moving the caret (live-mode.md § 4.2). */
	stepEdge?(e: KeyboardEvent): boolean;
	/** The spans in this block a caret can't stop inside, which a horizontal arrow crosses whole. */
	caretUnits: CaretUnitSource;
}

/** A raw `[start, end)` a caret can't stop inside: a widget, a replace decoration, a CRLF pair. */
export interface CaretUnit {
	start: number;
	end: number;
}

export interface CaretUnitSource {
	/** The span `offset` sits against or inside, on the side `direction` names. A plain arrow
	 *  crosses only the spans that read as one character; `extending`, every span. */
	beside(offset: number, direction: 'forward' | 'backward', extending: boolean): CaretUnit | null;
	/** Called once a press crossed a span: the widget edge a click held stops naming the caret. */
	crossed(): void;
}

/** True when the event was fully handled; the caller must skip its block-specific branches. */
export async function handleSharedKeydown(
	e: KeyboardEvent,
	ctx: SharedKeydownContext
): Promise<boolean> {
	if (endsSelectAllRun(e)) ctx.selection.resetSelectAllCount();

	// Before the cross-block dispatch and the caret memory, which would record the press as a step.
	if (handleEdgeStep(e, ctx)) return true;

	if (await ctx.crossBlock.handleKeyDown(e)) return true;

	const el = ctx.getEl();
	if (!el) return false;

	ctx.caretMemory.noteKey(e, commandAtBlock(e, ctx), () => getCurrentCursorEditorRelativeX(el));

	// Ctrl+Y fires no `historyRedo` beforeinput in Chromium and WebView2, so every chord with a
	// native history default is suppressed here; the block's own dispatch runs the command.
	const historyChord = eventToChord(e);
	if (historyChord && isDefaultGlobalChord(historyChord, ctx.commands.activation)) {
		e.preventDefault();
		return false;
	}

	// Cmd+Arrow is a caret-edge key, never a step: only the edge sites read it.
	const edge = caretEdgeKey(e);
	if (handleBlockEdgeChord(e, edge, ctx, el)) return true;
	if (edge) return false;

	// The moving end, read once for the span step and the boundary check: with Shift the focus, since
	// a forward range's start is its anchor, which extends across blocks while the focus contracts.
	const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
	const stepOffset = !horizontal ? null : e.shiftKey ? ctx.getFocusOffset() : ctx.getCursorOffset();

	// After the key note, so the press still resets the sticky column as any horizontal step does.
	if (horizontal && handleUnitStep(e, ctx, el, stepOffset)) return true;

	// ── Arrow boundary navigation ─────────────────────────────────────────
	const index = ctx.getIndex();
	const myPath = ctx.getMyPath();
	// Lazy: off the arrow path the block's bounds are never asked for, and the resolve
	// walks the block's DOM.
	let cachedBounds: LandableBounds | null = null;
	const bounds = () => (cachedBounds ??= caretLandableBounds(ctx, el));

	// The selection's moving end, which the line check measures: after a forward extension the
	// anchor stays mid-block while the focus sits at the boundary.
	const verticalOffset = () => ctx.getFocusOffset() ?? ctx.getCursorOffset() ?? 0;

	if (e.key === 'ArrowUp') {
		const offset = verticalOffset();
		if (isAtFirstVisualLine(el, offset, bounds())) {
			// Cross the boundary only when focus is already at the block's first reachable
			// offset, so native Shift+ArrowUp extension has nowhere left to go within it.
			if (e.shiftKey && offset <= bounds().start) {
				e.preventDefault();
				extendFocusToPreviousBlock(ctx, el, myPath, 'start');
				return true;
			}
			if (!e.shiftKey && !e.altKey) {
				e.preventDefault();
				void ctx.focus.moveFocus(index - 1, { stickyColumnFrom: 'below' });
				return true;
			}
		}
	}

	if (e.key === 'ArrowDown') {
		const offset = verticalOffset();
		if (isAtLastVisualLine(el, offset, bounds())) {
			// Cross the boundary only when focus is already at the block's last reachable
			// offset, so native Shift+ArrowDown extension has nowhere left to go.
			if (e.shiftKey && offset >= bounds().end) {
				e.preventDefault();
				extendFocusToNextBlock(ctx, el, myPath, 'vertical');
				return true;
			}
			if (!e.shiftKey && !e.altKey) {
				e.preventDefault();
				void ctx.focus.moveFocus(index + 1, { stickyColumnFrom: 'above' });
				return true;
			}
		}
	}

	if (e.key === 'ArrowLeft') {
		const offset = e.shiftKey ? (stepOffset ?? bounds().start) : stepOffset;
		if (offset !== null && offset <= bounds().start) {
			if (e.shiftKey) {
				e.preventDefault();
				extendFocusToPreviousBlock(ctx, el, myPath);
				return true;
			}
			e.preventDefault();
			void ctx.focus.moveFocus(index - 1, 'end');
			return true;
		}
	}

	if (e.key === 'ArrowRight') {
		const offset = e.shiftKey ? (stepOffset ?? bounds().end) : stepOffset;
		if (offset !== null && offset >= bounds().end) {
			if (e.shiftKey) {
				e.preventDefault();
				extendFocusToNextBlock(ctx, el, myPath);
				return true;
			}
			e.preventDefault();
			void ctx.focus.moveFocus(index + 1, 'start');
			return true;
		}
	}

	return false;
}

/** A plain arrow at a hidden construct edge moves the side the caret means, not the caret
 *  (live-mode.md § 4.2). Runs ahead of everything that reads the press as a step; true if claimed. */
export function handleEdgeStep(
	e: KeyboardEvent,
	ctx: Pick<SharedKeydownContext, 'selection' | 'stepEdge'>
): boolean {
	if (ctx.selection.isCrossBlock || !ctx.stepEdge) return false;
	let stepped = edgeStepByEvent.get(e);
	if (stepped === undefined) {
		stepped = ctx.stepEdge(e);
		edgeStepByEvent.set(e, stepped);
	}
	if (stepped) e.preventDefault();
	return stepped;
}

// A table cell asks ahead of its navigation plan as well as here, so each event is read once.
const edgeStepByEvent = new WeakMap<KeyboardEvent, boolean>();

/** A horizontal arrow beside a span the caret can't stop inside lands at its far edge in one press,
 *  decided here because WebKit and Firefox step natively into or past one. True if claimed. */
function handleUnitStep(
	e: KeyboardEvent,
	ctx: SharedKeydownContext,
	el: HTMLElement,
	offset: number | null
): boolean {
	if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || ctx.selection.isCrossBlock) {
		return false;
	}
	const extending = e.shiftKey;
	// A plain arrow over a range collapses it, which is the browser's.
	if (!extending && holdsNativeRange()) return false;
	if (offset === null) return false;
	const direction = e.key === 'ArrowRight' ? 'forward' : 'backward';
	const unit = ctx.caretUnits.beside(offset, direction, extending);
	if (!unit) return false;
	e.preventDefault();
	const target = direction === 'forward' ? unit.end : unit.start;
	if (extending) extendWithinBlock(ctx, el, target);
	else ctx.caretWriter.placeCaretAtRaw(el, target, { clamp: 'exact' });
	ctx.caretUnits.crossed();
	return true;
}

/** A block-edge key where a marker or a widget sits at that end of the text lands on the text's
 *  edge: Firefox's own stops short of a widget, and only macOS moves for Cmd+Arrow. */
function handleBlockEdgeChord(
	e: KeyboardEvent,
	edge: CaretEdgeKey | null,
	ctx: SharedKeydownContext,
	el: HTMLElement
): boolean {
	if (edge?.to !== 'block' || ctx.selection.isCrossBlock) return false;
	const toEnd = edge.side === 'end';
	const guarded = toEnd
		? landableEndAbutsIsland(el)
		: markerPrefixOf(el) !== null || landableStartAbutsIsland(el);
	if (!guarded) return false;
	e.preventDefault();
	const bounds = caretLandableBounds(ctx, el);
	ctx.caretWriter.placeCaretAtRaw(el, toEnd ? bounds.end : bounds.start, { clamp: 'reachable' });
	return true;
}

// ── Block bounds ───────────────────────────────────────────────────────────

export interface LandableBounds {
	start: number;
	end: number;
}

/** The reads the bounds need, so a block-edge check outside this file can ask without building
 *  the whole keydown context. */
export interface LandableBoundsContext {
	/** textContent length in raw-content coordinates (the marker prefix excluded). */
	getTextLen(): number;
}

/** The raw offsets a caret can reach in the block, from the same walk that places it: hidden
 *  markers put bytes out of reach, so every block-edge check reads this, not 0 and length. */
export function caretLandableBounds(ctx: LandableBoundsContext, el: HTMLElement): LandableBounds {
	return landableRawBounds(el) ?? { start: 0, end: ctx.getTextLen() };
}
