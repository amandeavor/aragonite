'use client';
/**
 * A plugin block drawn by a React component. The component renders into the element the editor
 * made for the block, synchronously, so an element it hands over (`<LeafContent>`,
 * `<BlockChildren>`) is in place by the time the editor's `mount` or `update` call returns.
 */

import {
	createContext,
	useContext,
	type ComponentType,
	type HTMLAttributes,
	type ReactNode
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
	defineBlockView,
	type BlockView,
	type BlockViewSpec,
	type BlockViewState,
	type ContainerViewContext,
	type ContainerViewSpec,
	type LeafViewContext,
	type LeafViewSpec,
	type RenderPrimaryViewContext,
	type RenderPrimaryViewSpec
} from '@voithos-labs/aragonite/plugin';

// ── Public API ──────────────────────────────────────────────────────────────

interface Surfaces {
	leaf: { spec: LeafViewSpec; ctx: LeafViewContext };
	'render-primary': { spec: RenderPrimaryViewSpec; ctx: RenderPrimaryViewContext };
	container: { spec: ContainerViewSpec; ctx: ContainerViewContext };
}

/** What the editor builds into a framework-drawn block: editable text, shown always or behind a
 *  rendered view until a click, or child blocks. */
export type FrameworkSurface = keyof Surfaces;

/** What the block's component gets: the block's state, and the editor calls for its surface. */
export interface BlockViewProps<S extends FrameworkSurface = 'leaf'> {
	state: BlockViewState;
	ctx: Surfaces[S]['ctx'];
}

export type ReactBlockViewOptions<S extends FrameworkSurface> = Omit<
	Surfaces[S]['spec'],
	'mount'
> & {
	/** Classes for the element the editor made for the block, which it measures as the block. */
	className?: string;
	/** Hears each change to the shown text, once, never mid-composition; leaf surfaces only. */
	afterInput?: S extends 'container' ? never : (text: string, ctx: Surfaces[S]['ctx']) => void;
	/** Wraps the component, for providers: the block renders in a React root of its own, which
	 *  a provider in the host app doesn't reach. */
	wrap?: (block: ReactNode) => ReactNode;
};

/** A block view drawn by `Component`; a render-primary block's whole element opens its text. */
export function reactBlockView<S extends FrameworkSurface>(
	Component: ComponentType<BlockViewProps<S>>,
	options: { surface: S } & ReactBlockViewOptions<S>
): BlockView {
	const { className, afterInput, wrap, ...spec } = options;
	return defineBlockView({
		...spec,
		mount(target: HTMLElement, ctx: Surfaces[S]['ctx']) {
			if (className) target.className = className;
			if (spec.surface === 'render-primary') {
				(ctx as RenderPrimaryViewContext).leaf.attachRendered(target);
			}
			const handOver = handOverFor(ctx);
			const root = createRoot(target);
			const draw = (state: BlockViewState) => {
				const block = (
					<HandOverContext.Provider value={handOver}>
						<Component state={state} ctx={ctx} />
					</HandOverContext.Provider>
				);
				flushSync(() => root.render(wrap ? wrap(block) : block));
			};
			draw(ctx.state());
			return {
				update: draw,
				afterInput: afterInput && ((text: string) => afterInput(text, ctx as never)),
				destroy() {
					handOver.live = false;
					// React refuses to unmount a root inside its own commit, where the host app's
					// unmount lands; the editor never reuses `target`, so a microtask later is safe.
					queueMicrotask(() => root.unmount());
				}
			};
		}
	} as BlockViewSpec);
}

type ContentProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
	as?: 'div' | 'span' | 'p' | 'pre';
};

/** The element the editor edits the block's text in. It renders empty: the text is the editor's. */
export function LeafContent({ as: Tag = 'div', ...attributes }: ContentProps) {
	return <Tag {...attributes} ref={useHandOver('LeafContent').attach} />;
}

/** The element the editor mounts the block's children into, after anything you render beside. */
export function BlockChildren({ as: Tag = 'div', ...attributes }: ContentProps) {
	return <Tag {...attributes} ref={useHandOver('BlockChildren').mountChildren} />;
}

// ── Internal ────────────────────────────────────────────────────────────────

/** One per mount, so each ref callback keeps its identity across renders: a new one would be
 *  called with null first, and the editor empties an element handed back to it. */
interface HandOver {
	live: boolean;
	attach(el: HTMLElement | null): void;
	mountChildren(el: HTMLElement | null): void;
}

const HandOverContext = createContext<HandOver | null>(null);

function handOverFor(ctx: BlockViewProps<FrameworkSurface>['ctx']): HandOver {
	const handOver: HandOver = {
		live: true,
		attach(el) {
			if (!handOver.live) return;
			if (!('leaf' in ctx)) throw new Error('<LeafContent> is for a leaf or render-primary block');
			ctx.leaf.attach(el);
		},
		mountChildren(el) {
			if (!handOver.live || !el) return;
			if (!('container' in ctx)) throw new Error('<BlockChildren> is for a container block');
			ctx.container.mountChildren(el);
		}
	};
	return handOver;
}

function useHandOver(name: string): HandOver {
	const handOver = useContext(HandOverContext);
	if (!handOver) throw new Error(`<${name}> renders only inside a reactBlockView component`);
	return handOver;
}
