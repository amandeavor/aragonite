// DOM block views of the Svelte fixtures beside them, for suites that run each row over both
// forms of one block, plus a log of what the editor called on each view.
import {
	defineBlockView,
	definePlugin,
	type BlockView,
	type BlockViewHandle,
	type BlockViewState,
	type EditorPlugin,
	type LeafViewContext,
	type LeafViewHandle
} from '#lib/plugin.js';
import { svelteBlockView } from '#lib/svelte.js';
import { testLeaf } from '#lib/test/harness/test-kinds.js';
import PlainLeafBlock from './PlainLeafBlock.svelte';

export interface ViewLog {
	mounts: HTMLElement[];
	updates: BlockViewState[];
	/** Each update's raw as it arrived; `state.node` is the live node. */
	raws: string[];
	destroys: number;
}

export const newViewLog = (): ViewLog => ({ mounts: [], updates: [], raws: [], destroys: 0 });

/** Records the lifecycle into `log`, and lets a row add to the handle. */
export function loggedHandle<H extends BlockViewHandle>(
	log: ViewLog,
	target: HTMLElement,
	extra: H = {} as H
): H {
	log.mounts.push(target);
	return {
		update: (state: BlockViewState) => {
			log.updates.push(state);
			log.raws.push(state.node.raw);
		},
		destroy: () => {
			log.destroys++;
		},
		...extra
	};
}

/** `PlainLeafBlock` as a DOM view: one element, handed over for the editor to edit. */
export function domPlainLeaf(
	log: ViewLog = newViewLog(),
	extend?: (target: HTMLElement, ctx: LeafViewContext) => Partial<LeafViewHandle>
): BlockView {
	return defineBlockView({
		surface: 'leaf',
		mount(target, ctx) {
			const el = document.createElement('div');
			el.className = 'plain-leaf-block';
			el.style.whiteSpace = 'pre-wrap';
			target.append(el);
			ctx.leaf.attach(el);
			return loggedHandle(log, target, extend?.(target, ctx));
		}
	});
}

/** The two forms of the plain leaf, for `describe.each`. */
export const PLAIN_LEAF_FORMS: { form: string; view: () => BlockView }[] = [
	{ form: 'a Svelte component', view: () => svelteBlockView(PlainLeafBlock) },
	{ form: 'a DOM view', view: () => domPlainLeaf() }
];

export const MARKER_LINE = '@@ ';

/** A plugin whose `@@ ` line is one block drawn by `view`. */
export function markerLeafPlugin(view: BlockView, name = 'dom-view-leaf'): EditorPlugin {
	return definePlugin({
		name,
		setup: () => {
			testLeaf(name, (kind) => ({
				opener: {
					priority: 25,
					interruptsParagraph: false,
					tryOpen: (ctx) =>
						ctx.line.text.startsWith(MARKER_LINE)
							? {
									node: { kind, leadingTrivia: ctx.leadingTrivia, raw: ctx.line.raw },
									consumed: 1
								}
							: null
				},
				view
			}));
		}
	});
}
