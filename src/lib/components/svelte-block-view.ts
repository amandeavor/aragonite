/** A block kind drawn by a Svelte component: what `svelteBlockView` registers and BlockHost mounts. */

import type { Component } from 'svelte';
import type { NodeView } from '../core/node-views';
import type { BlockComponentExports, BlockComponentProps } from '../block-component';
import { asBlockView, type BlockView } from '../schema/block-view-registry';

export interface SvelteBlockEntry {
	/** Typed with `BlockComponentExports` so BlockHost's `bind:this` type-checks a component picked
	 *  at runtime. */
	component: Component<Record<string, unknown>, BlockComponentExports>;
	extraProps?: (node: NodeView) => Record<string, unknown>;
}

/** A block view drawn by `component`, plus `extraProps`. A component publishing no block surface
 *  fails to compile here instead of mounting as a block nothing can focus. */
export function svelteBlockView<P extends Partial<BlockComponentProps> & Record<string, unknown>>(
	component: Component<P, BlockComponentExports>,
	extraProps?: (node: NodeView) => Record<string, unknown>
): BlockView {
	const entry: SvelteBlockEntry = {
		component: component as SvelteBlockEntry['component'],
		extraProps
	};
	return asBlockView(entry);
}

/** The component and props behind a registered view; every view is a Svelte entry today. */
export function svelteBlockEntry(view: BlockView | undefined): SvelteBlockEntry | undefined {
	return view as unknown as SvelteBlockEntry | undefined;
}
