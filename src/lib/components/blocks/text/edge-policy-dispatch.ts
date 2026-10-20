/**
 * The one place a caret-edge key is decided in a prose block. A plain Backspace, Delete or
 * printable key at a caret edge resolves against a declared policy (the inline construct's beside
 * the caret, or the ancestor container's at the content start), never native editing, which would
 * corrupt the bytes those constructs stand for (G4.12). Which side of a hidden delimiter a typed
 * byte lands on is the write's question, not a key's (`caret/next-insertion.ts`).
 */

import type { ContentWrite } from '../../../action-contracts';
import type { NodeView } from '../../../core/node-views';
import type { InlineNode } from '../../../core/nodes';
import type { InlineWidgetEditingPolicy } from '../../../core/inline/inline-widgets';
import { resolvedInlineContent } from '../../../core/inline/inline-cache';
import { getContentRange, structuralSuffix } from '../../../core/inline';
import { getInlineWidgetEditing } from '../../../core/inline/inline-widgets';
import { isBlankText, trimTrailingLineEnding } from '../../../core/lines';
import { type RawOffset } from '../../../caret/coordinate-spaces';
import type { BlockPendingMarks } from '../../../caret/pending-marks';
import type { InsideCloserView } from '../../../caret/inside-closer';
import {
	keptBlockText,
	landableRawBounds,
	markerPrefixOf,
	hidingScreenOf,
	hidesBlockPrefix,
	type CaretWriter,
	type EditedBlock
} from '../../../caret/widget-offset';
import { characterExtent, type DeleteSpan } from '../../../caret/delete-extent';
import { recordIslandKeyScan } from '../../../perf/instruments';
import { hasModifier, isPlainTypingKey } from './click-snap-guard';
import { caretIsInTextContent } from '../../../caret/text-seat';
import { createMarkerCompletion } from './marker-completion';
import {
	resolveEdgeDeletion,
	type DeleteDirection,
	type EdgeDeletion
} from './construct-edge-delete';
import { replaceRangeInLeaf } from '../../../tree-operations/leaf-range';
import { widgetAtCursor, widgetsIn, type WidgetAtCursor } from './widget-adjacency';
import type { CaretUnitSource } from '../../../selection/shared-keydown';
import { readNativeSelection } from '../../../selection/native-bridge';
import type { Reading } from '../../../schema/reading';
import type { StoredAs } from '../../../schema/stored-as';
import { rangeWrite, withOwnEnding, type TextWrite } from '../editable/surface-write';

/** The part of the inline-widget editing policy the built-in widget rules reuse, in the same
 *  terms but without widening the public API. */
export type EdgePolicy = Pick<InlineWidgetEditingPolicy, 'onEdge' | 'deleteGranularity'>;

const REPLACE_ISLAND_POLICY: EdgePolicy = {
	onEdge: 'step-over',
	deleteGranularity: 'select-then-delete'
};
const WIDGET_ISLAND_POLICY: EdgePolicy = { onEdge: 'step-over' };

interface IslandSpan {
	start: number;
	end: number;
	el: HTMLElement;
}

/** Reactive state arrives as getters, so a captured value can't go stale under
 *  re-render. */
export interface EdgePolicyDispatchDeps {
	get node(): NodeView;
	get index(): number;
	/** The nearest ancestor container, or null at the document root. A key at the content start
	 *  resolves against its declaration. */
	get containerParent(): NodeView | null;
	/** How the editor reads its bytes, the grammar the render path drew widgets with included. */
	get reading(): Reading;
	getEl: () => HTMLElement | null;
	/** Where this block's bytes are stored, read when a rewrite asks, so a cut reads its candidate
	 *  back as it will be kept: a cell's text as text, a list item's behind its marker. */
	storedAs: () => StoredAs;
	/** Whether this block carries any decoration widgets. It reads the same source the render
	 *  drew from, so a false cannot disagree with the DOM and safely skips the scan. */
	hasIslands: () => boolean;
	/** Anchor/focus raw-content offsets of the live selection, or null when collapsed. */
	getRawSelection: () => { start: RawOffset; end: RawOffset } | null;
	/** The block's one write to its own text, which anchors undo and puts the caret back. */
	writeText: (write: TextWrite) => ContentWrite;
	/** Write the space that finishes the container's marker in front of this block, as one write
	 *  of the container's own line. */
	completeMarker: () => void;
	setSnapTarget: (offset: number | null) => void;
	/** A widget's source is showing: the CST still calls it atomic, but the DOM holds editable
	 *  text, so the widget branch does nothing and lets native editing run. */
	isRevealing: () => boolean;
	/** Enter the widget, either by showing its source or by selecting it. This dispatch decides
	 *  which widget a key is aimed at; the callback decides what entering it means. */
	enterWidget: (
		widget: { start: number; end: number; kind: InlineNode['kind'] },
		fromTrailingEdge: boolean
	) => void;
	/** Replace the edge policy for a widget this block draws on its own terms, where the kind's
	 *  registered policy names a gesture the block cannot show. `undefined` keeps the registered one. */
	widgetEdgePolicy?: (widget: {
		start: number;
		end: number;
		kind: InlineNode['kind'];
	}) => EdgePolicy | undefined;
	/** Reading mode: the decoration-widget and marker-prefix branches do nothing at all, and the
	 *  widget branch writes nothing, though it still selects. */
	isReading: () => boolean;
	/** The block's pending marks, where a press that unwraps a construct pends the kinds it took. */
	pendingMarks: BlockPendingMarks;
	/** The editor's caret writer, which selects a decoration widget whole. */
	caretWriter: CaretWriter;
	/** The caret Edit link left before a hidden closer, which a letter taken back keeps there. */
	insideCloser: () => InsideCloserView;
}

export interface EdgePolicyDispatch {
	/** A plain edge key against a caret-adjacent construct. Returns whether the event
	 *  was consumed; a false return leaves the key to the shared keymap below. */
	handleKeydown(e: KeyboardEvent, caretOffset: RawOffset | null): boolean;
	/** The order `handleKeydown` walks, ids and reasons only. The order is what the rule fixes
	 *  (G4.12), so it is readable here rather than something a test has to re-derive. */
	readonly arms: readonly { id: string; reason: string }[];
	/** The widgets and replace decorations a horizontal arrow crosses whole, for the shared
	 *  keydown, which decides that step before any arm here runs. */
	readonly inlineUnits: CaretUnitSource;
	/** Writes `typed` at `caret` when the caret sits right before a widget that ends the block,
	 *  where Firefox fires the insertion's `beforeinput` and inserts nothing. True if written. */
	typeBeforeClosingWidget(caret: number, typed: string): boolean;
	/** A collapsed delete that reached `beforeinput`, by the rules the keys above follow, then the
	 *  character rule; false while a shown source holds bytes the tree hasn't seen. */
	deleteAtCaret(caret: number, direction: DeleteDirection): boolean;
}

/** One family of gestures, listed in the order the families outrank each other. A family is not a
 *  per-construct policy row; `policy-arm-census.test.ts` checks that split. */
interface DispatchArm {
	id: string;
	reason: string;
	/** A cut ends the dispatch as unhandled when it fires, leaving the key to the keymap below;
	 *  every other entry consumes the event. */
	cut?: boolean;
	claims: (e: KeyboardEvent, caretOffset: RawOffset | null) => boolean;
}

export function createEdgePolicyDispatch(deps: EdgePolicyDispatchDeps): EdgePolicyDispatch {
	const markerCompletion = createMarkerCompletion();
	const arms: readonly DispatchArm[] = [
		{
			id: 'cst-widget',
			reason: 'a key aimed at an atomic construct is the widget branch’s before any byte rule',
			claims: handleCstWidget
		},
		{
			id: 'reading-mode',
			reason:
				'inline widgets and the container’s marker prefix are destructive-only view guards, so reading skips every branch below; the widget branch above still selects, committing nothing',
			cut: true,
			claims: () => deps.isReading()
		},
		{
			id: 'decoration-island',
			reason: 'a view-only range with no on-screen bytes of its own to eat',
			claims: handleIsland
		},
		{
			id: 'ambient-marker',
			reason:
				'a selection into the ambient span blocks native delete silently, with no beforeinput',
			claims: handleAmbient
		},
		// The three below handle only what would otherwise reach native editing or the block-merge
		// command; the more specific families above still take a key aimed at one of theirs.
		{
			id: 'construct-edge-delete',
			reason: 'a destructive key beside an unpainted delimiter run takes content, never a marker',
			claims: handleConstructEdgeDelete
		},
		{
			id: 'marker-completion',
			reason: 'the container re-emits this space itself, so writing it here would double it',
			claims: handleMarkerCompletion
		}
	];

	function handleKeydown(e: KeyboardEvent, caretOffset: RawOffset | null): boolean {
		for (const arm of arms) {
			if (arm.claims(e, caretOffset)) return arm.cut !== true;
		}
		return false;
	}

	/** The kind's registered policy, unless this block draws the widget on its own terms. */
	function widgetPolicy(widget: InlineNode | WidgetAtCursor): EdgePolicy | undefined {
		return (
			deps.widgetEdgePolicy?.(widget) ?? getInlineWidgetEditing(widget.kind, deps.reading.grammar)
		);
	}

	function inlinesOf(node: NodeView): InlineNode[] {
		return resolvedInlineContent(node, deps.reading);
	}

	function display(): string {
		return trimTrailingLineEnding(deps.node.raw);
	}

	/** One rewrite of the displayed text a key makes, one CST commit, its bytes already where the
	 *  key put them. */
	function writeDisplay(text: string, caretAfter: number, source: string): void {
		void deps.writeText({
			text,
			caretAfter,
			intent: 'typed',
			mode: 'authored',
			source,
			inPlace: true
		});
	}

	/** `span` replaced by `insert` through the in-leaf range replace, the store read at the key. */
	function rangeEdit(span: DeleteSpan, insert: string): Pick<TextWrite, 'text' | 'caretAfter'> {
		return rangeWrite(deps.node, replaceRangeInLeaf(deps.node, span, insert, deps.storedAs()));
	}

	function editDisplay(start: number, end: number, insert: string, source = 'island'): void {
		void deps.writeText({
			...rangeEdit({ start, end }, insert),
			intent: 'typed',
			mode: 'authored',
			source
		});
	}

	/** The selected range, or null at a plain caret; every branch reads it here. Empty when both ends
	 *  clamp into the marker prefix, so a branch that writes bytes checks `end > start` first. */
	function heldRange(): { start: number; end: number } | null {
		return deps.getRawSelection();
	}

	// ── The shared helpers the branches below use ────────────────────────────

	/** What the construct-edge rule (live-mode.md § 4.4) does with a destructive key here, or null
	 *  where the block draws its markers and the byte beside the caret is one the user can see. */
	function edgeDeletionAt(
		el: HTMLElement,
		caret: number,
		direction: DeleteDirection
	): EdgeDeletion | null {
		const screen = hidingScreenOf(el);
		if (!screen) return null;
		return resolveEdgeDeletion({
			display: display(),
			asWritten: (text) => withOwnEnding(deps.node, text),
			content: getContentRange(deps.node),
			caret,
			direction,
			screen,
			inlines: inlinesOf(deps.node),
			store: deps.storedAs()
		});
	}

	/** A keypress with no safe rewrite writes nothing: the browser's version would show the
	 *  delimiters the rule was hiding. */
	function applyEdgeDeletion(deletion: EdgeDeletion, caret: number): void {
		if ('swallow' in deletion) return;
		// A letter taken back from Edit link's caret leaves the caret inside the URL still; the
		// write ends every record, so it is opened again where the cut left the caret.
		const tookOnlyBefore = deletion.caret + display().length - deletion.raw.length === caret;
		const stillInside = deps.insideCloser().at() === caret && tookOnlyBefore;
		writeDisplay(deletion.raw, deletion.caret, 'construct-delete');
		if (stillInside) deps.insideCloser().open(deletion.caret);
		// Pended after the write, since the write clears pending marks; the caret has not moved, so
		// the format waits for the next insertion (live-mode.md § 4.4).
		for (const kind of deletion.unwrappedMarks) deps.pendingMarks.toggle(kind);
	}

	/** A printable byte the browser would drop at an element-level caret: over a range through the
	 *  join rules, at a caret as an insertion the write places like any other. */
	function writeTypedByte(caretOffset: number, typed: string, source: string): void {
		const range = heldRange();
		if (range && range.end > range.start) editDisplay(range.start, range.end, typed, source);
		else editDisplay(caretOffset, caretOffset, typed, source);
	}

	// ── CST inline widget ────────────────────────────────────────────────────

	function handleCstWidget(e: KeyboardEvent, caretOffset: RawOffset | null): boolean {
		if (deps.isRevealing()) return false;
		if (caretOffset === null) return false;
		const node = deps.node;
		// Forward keys enter the widget after the caret, backward keys the one before, so
		// a caret between two adjacent widgets enters the one the key is aimed at.
		const direction = e.key === 'ArrowRight' || e.key === 'Delete' ? 'forward' : 'backward';
		const widgetAt = widgetAtCursor(caretOffset, widgetsIn(node, deps.reading), direction);
		if (!widgetAt) return false;
		// Past the early return: every keystroke in every prose block reaches the line above, so
		// the work below stays off that path.
		const range = heldRange();

		// No modifier, and a collapsed caret: a modifier makes the key a word-scoped platform
		// command, and a selected range is an edit of that range, not an entry into a construct.
		const plainEdgeKey = !e.shiftKey && !hasModifier(e) && !range;
		const enterFromRight =
			plainEdgeKey && widgetAt.atRight && (e.key === 'ArrowLeft' || e.key === 'Backspace');
		const enterFromLeft =
			plainEdgeKey && !widgetAt.atRight && (e.key === 'ArrowRight' || e.key === 'Delete');
		if (enterFromRight || enterFromLeft) {
			e.preventDefault();
			takeOrEnterWidget(widgetAt, e.key === 'Backspace' || e.key === 'Delete');
			return true;
		}
		// Chromium inserts into a text node natively, but drops printable keys at
		// element-level positions adjacent to a contenteditable=false widget.
		const el = deps.getEl();
		if (el && !caretIsInTextContent(el) && isPlainTypingKey(e) && !deps.isReading()) {
			e.preventDefault();
			deps.setSnapTarget(null);
			writeTypedByte(caretOffset, e.key, 'widget');
			return true;
		}
		return false;
	}

	/** A key aimed at the widget beside the caret: a delete takes an atomic one whole, and any other
	 *  key or kind enters it (`onEdge: 'select'`, or the source a kind shows instead). */
	function takeOrEnterWidget(widget: WidgetAtCursor, destructive: boolean): void {
		deps.setSnapTarget(null);
		if (destructive && widgetPolicy(widget)?.deleteGranularity === 'atomic' && !deps.isReading()) {
			editDisplay(widget.start, widget.end, '', 'widget');
			return;
		}
		deps.enterWidget(widget, widget.atRight);
	}

	// ── Decoration widgets ───────────────────────────────────────────────────

	function islandsInDom(el: HTMLElement): IslandSpan[] {
		recordIslandKeyScan();
		const out: IslandSpan[] = [];
		for (const node of el.querySelectorAll<HTMLElement>('[data-decoration-island]')) {
			const start = Number(node.dataset.sourceStart);
			const end = Number(node.dataset.sourceEnd);
			if (Number.isInteger(start) && Number.isInteger(end)) out.push({ start, end, el: node });
		}
		return out;
	}

	function islandPolicy(island: IslandSpan): EdgePolicy {
		return island.end > island.start ? REPLACE_ISLAND_POLICY : WIDGET_ISLAND_POLICY;
	}

	function selectIslandWhole(el: HTMLElement): void {
		const range = document.createRange();
		range.selectNode(el);
		deps.caretWriter.selectDomRange(range);
	}

	function handleIsland(e: KeyboardEvent, caretOffset: RawOffset | null): boolean {
		// Modifier chords stay with the browser; these rules take only the plain edge keys.
		const isDestructive = !hasModifier(e) && (e.key === 'Backspace' || e.key === 'Delete');
		const isTyping = isPlainTypingKey(e);
		if (!isDestructive && !isTyping) return false;

		// Blocks with no decoration widgets, the common case, skip the per-keystroke DOM scan.
		if (!deps.hasIslands()) return false;

		const el = deps.getEl();
		if (!el) return false;
		const islands = islandsInDom(el);
		if (islands.length === 0) return false;

		// Second keypress: the browser selection already wraps a replace widget, so delete its
		// whole hidden range through the CST as one undo entry.
		if (isDestructive) {
			const selection = heldRange();
			if (selection) {
				const selected = islands.find(
					(i) =>
						islandPolicy(i).deleteGranularity === 'select-then-delete' &&
						i.start === selection.start &&
						i.end === selection.end
				);
				if (selected) {
					e.preventDefault();
					editDisplay(selected.start, selected.end, '');
					return true;
				}
				// A different non-empty selection: leave it to the normal delete paths.
				return false;
			}
		}

		if (caretOffset === null) return false;
		if (isDestructive && islandDelete(el, islands, caretOffset, keyDirection(e))) {
			e.preventDefault();
			return true;
		}
		// Some browsers drop printable keys at an element-level caret beside a non-editable widget.
		// Chromium types them, so a unit test, not e2e, covers this branch.
		if (isTyping && !caretIsInTextContent(el)) {
			e.preventDefault();
			writeTypedByte(caretOffset, e.key, 'island');
			return true;
		}
		return false;
	}

	/** A collapsed delete beside a decoration: a replace widget is selected whole first, and a widget
	 *  decoration, which stands for no bytes, lets the byte beside it go. False at a block's edge. */
	function islandDelete(
		el: HTMLElement,
		islands: readonly IslandSpan[],
		caret: number,
		direction: DeleteDirection
	): boolean {
		const backward = direction === 'backward';
		const target = islands.find(
			(i) =>
				islandPolicy(i).deleteGranularity === 'select-then-delete' &&
				(backward ? i.end === caret : i.start === caret)
		);
		if (target) {
			selectIslandWhole(target.el);
			return true;
		}
		if (!islands.some((i) => i.start === i.end && i.start === caret)) return false;
		if (backward ? caret <= 0 : caret >= display().length) return false;
		// This branch outranks the construct-edge rule beside a hidden run, so it asks that rule.
		if (!hiddenRunDelete(el, caret, direction)) deleteCharacter(el, caret, direction);
		return true;
	}

	// ── Spans an arrow crosses whole ─────────────────────────────────────────

	/** Whether `offset` sits against or inside `span` on the side `direction` names; a zero-width
	 *  span holds no offset, since the caret crosses onto the real byte beside it. */
	function sideHolds(span: { start: number; end: number }, offset: number, forward: boolean) {
		return forward
			? span.start <= offset && offset < span.end
			: span.start < offset && offset <= span.end;
	}

	const inlineUnits: CaretUnitSource = {
		beside(offset, direction, extending) {
			// A shown source is editable text again, which the browser's arrows walk.
			if (deps.isRevealing()) return null;
			const forward = direction === 'forward';
			for (const widget of widgetsIn(deps.node, deps.reading)) {
				if (!sideHolds(widget, offset, forward)) continue;
				// A plain arrow enters a widget that selects or shows its source, in the arm below.
				const crosses = extending || widgetPolicy(widget)?.onEdge === 'step-over';
				return crosses ? { start: widget.start, end: widget.end } : null;
			}
			if (!deps.hasIslands()) return null;
			const el = deps.getEl();
			const island = el && islandsInDom(el).find((i) => sideHolds(i, offset, forward));
			return island ? { start: island.start, end: island.end } : null;
		},
		crossed: () => deps.setSnapTarget(null)
	};

	// ── Container marker prefix overlap ────────────────────────────────────────

	// A selection reaching into the contenteditable="false" marker prefix blocks the browser's
	// Backspace and Delete silently, with no beforeinput, so delete through the CST instead.
	function handleAmbient(e: KeyboardEvent): boolean {
		if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
		const range = heldRange();
		if (!range) return false;
		const el = deps.getEl();
		if (!el) return false;
		const ambient = markerPrefixOf(el);
		const live = readNativeSelection();
		const touchesAmbient =
			!!ambient &&
			!!live &&
			(ambient.contains(live.anchor.node) || ambient.contains(live.focus.node));
		if (!touchesAmbient) return false;
		e.preventDefault();
		// A selection holding only the marker prefix covers no content byte, so there is nothing
		// to delete and the press is consumed with no commit.
		if (range.end > range.start) {
			// Handled at keydown, so this branch asks the join rules itself, or a literal splice would
			// print the delimiter runs the cut stranded (`docs/design/live-mode.md` § 4.5).
			editDisplay(range.start, range.end, '', 'ambient-delete');
		}
		return true;
	}

	// ── Hidden construct edge (deleting) ───────────────────────────────────────

	/** A plain Backspace or Delete against a hidden delimiter run takes the neighbouring content
	 *  character instead of a byte the user never saw (`docs/design/live-mode.md` § 4.4). */
	function handleConstructEdgeDelete(e: KeyboardEvent, caretOffset: RawOffset | null): boolean {
		if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
		if (e.shiftKey || hasModifier(e)) return false;
		if (caretOffset === null || heldRange()) return false;
		const el = deps.getEl();
		if (!el) return false;
		// At the first offset the caret can sit at, Backspace is a block gesture (merge, or nothing),
		// not a delete of the first visible character past a hidden run.
		if (e.key === 'Backspace') {
			const bounds = landableRawBounds(el);
			if (bounds && caretOffset <= bounds.start) return false;
		}
		if (!hiddenRunDelete(el, caretOffset, keyDirection(e))) return false;
		e.preventDefault();
		return true;
	}

	/** The construct-edge rule's answer beside a hidden run, written; false where it has none. */
	function hiddenRunDelete(el: HTMLElement, caret: number, direction: DeleteDirection): boolean {
		const deletion = edgeDeletionAt(el, caret, direction);
		if (!deletion) return false;
		deps.setSnapTarget(null);
		applyEdgeDeletion(deletion, caret);
		return true;
	}

	// ── Any other collapsed delete ─────────────────────────────────────────────

	function deleteAtCaret(caret: number, direction: DeleteDirection): boolean {
		const el = deps.getEl();
		if (!el || deps.isRevealing()) return false;
		const widgetAt = widgetAtCursor(caret, widgetsIn(deps.node, deps.reading), direction);
		if (widgetAt && widgetAt.atRight === (direction === 'backward')) {
			takeOrEnterWidget(widgetAt, true);
			return true;
		}
		if (deps.hasIslands()) {
			const islands = islandsInDom(el);
			if (islands.length > 0 && islandDelete(el, islands, caret, direction)) return true;
		}
		if (!hiddenRunDelete(el, caret, direction)) deleteCharacter(el, caret, direction);
		return true;
	}

	/** The character rule's span (`caret/delete-extent.ts`) through the in-leaf range replace; a cut
	 *  that leaves a heading only its hidden markers empties the block, as the read-back does. */
	function deleteCharacter(el: HTMLElement, caret: number, direction: DeleteDirection): void {
		const text = display();
		const bounds = landableRawBounds(el) ?? { start: 0, end: text.length };
		const span = characterExtent(text, caret, direction, bounds);
		if (!span) return;
		deps.setSnapTarget(null);
		const written = rangeEdit(span, '');
		const kept = keptBlockText(editedBlock(el, text, span, written.text));
		if (kept !== written.text) return writeDisplay(kept, 0, 'delete');
		void deps.writeText({ ...written, intent: 'typed', mode: 'authored', source: 'delete' });
	}

	/** The block as `keptBlockText` reads it once `span` is cut from `text`, the parts the input
	 *  read-back takes from the DOM. */
	function editedBlock(
		el: HTMLElement,
		text: string,
		span: DeleteSpan,
		after: string
	): EditedBlock {
		const range = getContentRange(deps.node);
		const hidesPrefix = range.start > 0 && hidesBlockPrefix(el);
		const from = hidesPrefix ? range.start : 0;
		const to = text.length - structuralSuffix(deps.node).length;
		const clip = (at: number) => Math.min(Math.max(at, from), to);
		const content = text.slice(from, clip(span.start)) + text.slice(clip(span.end), to);
		return { text: after, content, hidesPrefix, wasBlank: isBlankText(text.slice(from, to)) };
	}

	// ── Container marker completion ────────────────────────────────────────────

	/** A bare space at a child's content start, while its container's marker lacks its space, is
	 *  the marker's, once: written into the container's line, or left for an empty line's text. */
	function handleMarkerCompletion(e: KeyboardEvent, caretOffset: RawOffset | null): boolean {
		const bareSpace = e.key === ' ' && !e.shiftKey && !hasModifier(e);
		if (!bareSpace || caretOffset === null || heldRange()) return false;
		const { node, containerParent, index } = deps;
		const claim = markerCompletion.claimSpace(node, containerParent, index, caretOffset);
		if (claim === null) return false;
		e.preventDefault();
		if (claim === 'bare-marker') deps.completeMarker();
		return true;
	}

	function typeBeforeClosingWidget(caret: number, typed: string): boolean {
		if (deps.isRevealing() || deps.isReading() || heldRange()) return false;
		const end = getContentRange(deps.node).end;
		const widgets = widgetsIn(deps.node, deps.reading);
		if (!widgets.some((widget) => widget.start === caret && widget.end === end)) return false;
		writeTypedByte(caret, typed, 'closing-widget');
		return true;
	}

	function keyDirection(e: KeyboardEvent): DeleteDirection {
		return e.key === 'Backspace' ? 'backward' : 'forward';
	}

	return { handleKeydown, arms, inlineUnits, typeBeforeClosingWidget, deleteAtCaret };
}
