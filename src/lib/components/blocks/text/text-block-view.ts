import type { BlockView } from '../../../schema/block-view';
import { svelteBlockView } from '../../svelte-block-view';
import TextEditableBlock from './TextEditableBlock.svelte';

/** The editor's own plain editable text block as a view, the one paragraphs and raw kinds use;
 *  `blockClass` lands on its element. */
export function textBlockView(opts: { blockClass?: string } = {}): BlockView {
	const { blockClass } = opts;
	return svelteBlockView(TextEditableBlock, () => ({ blockClass }));
}
