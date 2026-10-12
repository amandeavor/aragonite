/**
 * View-only annotations layered over the rendered document. Decorations never enter the
 * CST: pure sources produce them per editor instance, and the overlays and inline widgets
 * consume them.
 */

import type { DocumentView } from '../core/node-views';

export interface MarkDecoration {
	type: 'mark';
	path: number[];
	start: number;
	end: number;
	class: string;
	attrs?: Record<string, string>;
	interactive?: MarkInteractions;
}

/** Where a hovered mark sits, in viewport coordinates: `anchor` is the rect the pointer entered,
 *  `rects` every rect the mark paints (one per visual line, one per table cell). */
export interface MarkHover {
	anchor: DOMRect;
	rects: DOMRect[];
}

interface MarkHandlers {
	onClick: (dec: MarkDecoration, ev: MouseEvent) => void;
	/** `hover` when the pointer enters the mark, `null` once the hover ends. */
	onHover: (dec: MarkDecoration, hover: MarkHover | null) => void;
	/** Run by the `decorations.activateAtCaret` command when the caret is in the mark; `anchor`
	 *  is the mark's rect on the caret's line. */
	onActivate: (dec: MarkDecoration, ctx: { anchor: DOMRect }) => void;
}

/**
 * A mark's handlers, at least one. A mark with `onClick` takes the click; a hover-only mark lets
 * it through to the text. A hover ends once: the pointer leaves the mark (into your popup too),
 * or the mark is removed, scrolled away, or goes with its document or editor. Its `null` says
 * only that the pointer left; whether a popup closes is up to you.
 */
export type MarkInteractions =
	| (Pick<MarkHandlers, 'onClick'> & Partial<MarkHandlers>)
	| (Pick<MarkHandlers, 'onHover'> & Partial<MarkHandlers>)
	| (Pick<MarkHandlers, 'onActivate'> & Partial<MarkHandlers>);

export interface WidgetDecoration {
	type: 'widget';
	path: number[];
	offset: number;
	side?: 'before' | 'after'; // default 'after'
	widget: DecorationWidgetSpec;
}
export interface ReplaceDecoration {
	type: 'replace';
	path: number[];
	start: number;
	end: number;
	widget?: DecorationWidgetSpec; // absent: renders a `class` span with no content
	class?: string;
}
export interface BlockDecoration {
	type: 'block';
	path: number[];
	class?: string;
	attrs?: Record<string, string>;
	badge?: DecorationWidgetSpec;
}
export type Decoration = MarkDecoration | WidgetDecoration | ReplaceDecoration | BlockDecoration;

/** Render keys don't track widget identity: same position + class ⇒ equal. Vary `class`
 *  to force a re-render. */
export type DecorationWidgetSpec =
	| { component: import('svelte').Component<{ decoration: Decoration }> }
	| { buildDom: (dec: Decoration) => HTMLElement };

export interface ProvideContext {
	/** Bumped once per document change, never by `invalidate()`. The memo key for a source that
	 *  caches its scan; `doc.children` identity is not one, since typing mutates in place. */
	editEpoch: number;
}
export interface DecorationSource {
	name: string; // per-instance unique; duplicate addSource throws
	// Property, not method, syntax on purpose: params then check contravariantly, so an
	// implementation annotating the mutable Document is a compile error.
	provide: (doc: DocumentView, ctx: ProvideContext) => Decoration[];
}
export interface DecorationSourceHandle {
	/** Synchronous: the decorations show the new result before it returns, which search's
	 *  `setQuery` relies on. A call from inside a commit runs once after the commit instead. */
	invalidate(): void;
	dispose(): void;
}
export interface DecorationRegistry {
	addSource(source: DecorationSource): DecorationSourceHandle;
}
