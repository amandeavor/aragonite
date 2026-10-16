/** The editor's plain editable text block as a block view: what paragraphs, raw kinds, title rows
 *  and a kind with no resolvable view all render through. */

import type { BlockView } from '../../../schema/block-view-registry';
import { svelteBlockView } from '../../svelte-block-view';
import TextEditableBlock from './TextEditableBlock.svelte';

export function textBlockView(opts: { blockClass?: string } = {}): BlockView {
	const { blockClass } = opts;
	return svelteBlockView(TextEditableBlock, () => ({ blockClass }));
}
