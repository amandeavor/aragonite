/** What draws a block kind, opaque here so this module's types name no UI framework. Only a
 *  function that builds a view brands one, and registration refuses anything unbranded. */

import type { BlockComponent } from '../block-component';
import type { NodeView } from '../core/node-views';
import type { PresentationMode } from '../presentation-mode';
import type { Draft, DraftSpec } from './drafts';
import type { EditorContext } from './plugin-install';

const blockViewBrand: unique symbol = Symbol('BlockView');
const viewForm = Symbol('BlockView.form');

/** What draws a block kind: `defineBlockView`, `textBlockView` or `svelteBlockView` (from
 *  `@voithos-labs/aragonite/svelte`) makes one. */
export interface BlockView {
	readonly [blockViewBrand]: true;
}

/** How a view draws: a Svelte component BlockHost renders inline, or a DOM spec its host mounts. */
export type BlockViewForm = 'svelte' | 'dom';

/** Marks `body` as a block view of `form`; only the functions that build a view call it. */
export function asBlockView<T extends object>(body: T, form: BlockViewForm): T & BlockView {
	return Object.assign(body, { [blockViewBrand]: true as const, [viewForm]: form });
}

export function isBlockView(value: unknown): value is BlockView {
	return (value as Partial<BlockView> | undefined)?.[blockViewBrand] === true;
}

export function blockViewForm(view: BlockView): BlockViewForm {
	return (view as unknown as Record<typeof viewForm, BlockViewForm>)[viewForm];
}

// ── DOM block views ─────────────────────────────────────────────────────────

/** What the editor builds around a DOM view: nothing, an editable text leaf, or child blocks. */
export type BlockSurface = BlockViewSpec['surface'];

/**
 * A block drawn into an element the editor makes for it. The view fills `target` itself (classes,
 * children) and never wraps a second box inside, because the editor measures `target` as the
 * block. `surface` says what the editor wires in: a leaf's editable text, a container's children.
 */
export type BlockViewSpec = HandBuiltViewSpec | LeafViewSpec | ContainerViewSpec;

interface ViewSpecBase {
	/** Calls `update` on every change to the document, not only to this block. */
	watchDocument?: boolean;
}

/** A block the view draws whole, publishing what the editor calls on it from its handle. */
export interface HandBuiltViewSpec extends ViewSpecBase {
	surface: 'none';
	mount(target: HTMLElement, ctx: BlockViewContext): HandBuiltViewHandle;
}

/** A block whose text the editor edits, in the element the view hands to `ctx.leaf.attach`. */
export interface LeafViewSpec extends ViewSpecBase {
	surface: 'leaf';
	/** The kind's bytes are one line: Enter splits the block rather than typing a newline. */
	singleLine?: boolean;
	mount(target: HTMLElement, ctx: LeafViewContext): LeafViewHandle;
}

/** A block holding child blocks, which the editor mounts into the box the view names. */
export interface ContainerViewSpec extends ViewSpecBase {
	surface: 'container';
	mount(target: HTMLElement, ctx: ContainerViewContext): BlockViewHandle;
}

/** The block as `update` sees it; `node` is read-only, and edits go through the surface. */
export interface BlockViewState {
	node: NodeView;
	path: readonly number[];
	presentationMode: PresentationMode;
	theme: string;
}

export interface BlockViewContext {
	/** The current state, read at call time. */
	state(): BlockViewState;
	/** The context of the editor drawing this block, for the plugin that owns its kind. */
	readonly editor: EditorContext;
}

export interface LeafViewContext extends BlockViewContext {
	readonly leaf: LeafSurface;
}

export interface ContainerViewContext extends BlockViewContext {
	readonly container: ContainerSurface;
}

export interface LeafSurface {
	/** The element inside `target` the editor edits the block's text in, holding no element of
	 *  the view's own (chrome goes beside it); null detaches it. */
	attach(el: HTMLElement | null): void;
	/** Focus the text with the caret at `offset`. */
	reveal(offset?: number): Promise<void>;
	/** Replace the block's text as one undo entry. */
	commitSource(text: string): void;
}

export interface ContainerSurface {
	/** Mount the child blocks into `box`, `target` or an element inside it, after the view's own
	 *  children; a chord bubbling from a child resolves against the kind's keymap there. */
	mountChildren(box: HTMLElement): void;
	/** Commit a shallow metadata patch as one undo entry, through the kind's `rebuildRaw`. */
	updateOwnMetadata(
		patch: Record<string, unknown>,
		options?: { caret?: { path: number[]; offset: number } }
	): void | Promise<void>;
	/** Hand the caret to the neighbour a plain arrow points at; false for any other key. */
	moveFocusOut(e: KeyboardEvent): boolean;
	/** Read the scroll position before a change of height; await the restore after it renders. */
	captureScrollPosition(): () => Promise<void>;
	openDraft(spec: DraftSpec): Draft;
}

export interface BlockViewHandle {
	/** The block's state changed. Returning false destroys the view and mounts it again. */
	update?(state: BlockViewState): boolean | void;
	destroy?(): void;
}

export interface LeafViewHandle extends BlockViewHandle {
	/** After the editor handled an input in the attached element (an IME commit included), with
	 *  its text. A throw here is reported on the `error` event; the block keeps drawing. */
	afterInput?(text: string): void;
}

// ── Where a DOM view's members come from ────────────────────────────────────

/** Who supplies a `BlockComponent` member for a DOM view: its handle, its host (from the kind's
 *  registration), the leaf or container surface, or nobody outside the editor. */
export type MemberSource = 'view' | 'host' | 'leaf-surface' | 'container-surface' | 'editor';

/** G3.18: every `BlockComponent` member has a source, so a new member fails `npm run check`
 *  until it's given one. */
export const MEMBER_SOURCES = {
	focus: 'view',
	getCursorOffset: 'view',
	focusable: 'view',
	parkCaret: 'view',
	focusAtColumn: 'view',
	getSelectedText: 'view',
	setSelection: 'view',
	measurePartialRects: 'view',
	getCommandContext: 'view',
	isCommandActive: 'view',
	runCommand: 'view',
	editable: 'host',
	insertMarkdown: 'leaf-surface',
	insertPlainText: 'leaf-surface',
	typeText: 'leaf-surface',
	afterSourceCommit: 'leaf-surface',
	afterSelectionRemoved: 'leaf-surface',
	childList: 'container-surface',
	focusByPath: 'container-surface',
	getCursorPosition: 'container-surface',
	enterEdgeWidget: 'container-surface',
	isVerticallyTransparent: 'container-surface',
	snapCaretToPoint: 'editor',
	startDragAtPoint: 'editor',
	cellRect: 'editor',
	mountedRowWindow: 'editor',
	getSelectionOffsets: 'editor',
	applyMenuClipboard: 'editor',
	claimRootClipboard: 'editor'
} as const satisfies Record<keyof BlockComponent, MemberSource>;

type HandBuiltMember = {
	[K in keyof typeof MEMBER_SOURCES]: (typeof MEMBER_SOURCES)[K] extends 'view' ? K : never;
}[keyof typeof MEMBER_SOURCES];

/** The members a hand-built view's handle may publish, read off `MEMBER_SOURCES`. */
export const HAND_BUILT_MEMBERS = (
	Object.keys(MEMBER_SOURCES) as (keyof typeof MEMBER_SOURCES)[]
).filter((key): key is HandBuiltMember => MEMBER_SOURCES[key] === 'view');

/** What the editor calls on a hand-built block; `editable` comes from the kind's registration. */
export type HandBuiltBlock = Pick<BlockComponent, HandBuiltMember>;

export type HandBuiltViewHandle = BlockViewHandle & HandBuiltBlock;

const SURFACES: readonly BlockSurface[] = ['none', 'leaf', 'container'];

/** A block view drawn by `spec`. Throws on a `surface` or `mount` it can't use. */
export function defineBlockView(spec: BlockViewSpec): BlockView {
	if (!SURFACES.includes(spec?.surface)) {
		throw new TypeError(
			`defineBlockView: \`surface\` must be one of ${SURFACES.map((s) => `'${s}'`).join(', ')}`
		);
	}
	if (typeof spec.mount !== 'function') {
		throw new TypeError('defineBlockView: `mount` must be a function');
	}
	return asBlockView({ spec: { ...spec } as BlockViewSpec }, 'dom');
}

/** The spec behind a DOM view. */
export function domViewSpec(view: BlockView): BlockViewSpec {
	return (view as unknown as { spec: BlockViewSpec }).spec;
}
