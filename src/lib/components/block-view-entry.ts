/** The one place that knows a view's form: what BlockHost renders for a registered view. */

import { blockViewForm, type BlockView } from '../schema/block-view';
import type { SvelteBlockEntry } from './svelte-block-view';

/** The component BlockHost renders for `view`, and the props it adds per node. */
export function blockViewEntry(view: BlockView): SvelteBlockEntry {
	const form = blockViewForm(view);
	if (form !== 'svelte') throw new TypeError(`BlockHost cannot draw a block view of form ${form}`);
	return view as unknown as SvelteBlockEntry;
}
