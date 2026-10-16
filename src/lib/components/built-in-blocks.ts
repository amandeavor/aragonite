/**
 * Built-in block component registrations, run by an explicit `registerBuiltInBlocks()` call: a
 * side-effect import could be dropped by a bundler, since `sideEffects` names only dist paths.
 * Lives in `components/` so `schema/` imports nothing downstream.
 */

import type { NodeView } from '../core/node-views';
import { metadataOf } from '../core/nodes';
import { shownKind } from '../core/parsers/heading';
import { registerBlockView, type BlockView } from '../schema/block-view-registry';
import { svelteBlockView } from '../components/svelte-block-view';
import { augmentBuiltin } from '../schema/block-kind-descriptor';
import { registerBuiltInDescriptors } from '../schema/built-in-descriptors';
import { augmentInlineWidgetKind } from '../core/inline/inline-widgets';
import { registerPasteSurface } from '../tree-operations/paste-surfaces';
import { registerBuiltInRangeIndent } from '../schema/range-indent-forms';
import { shiftBodyLines } from './blocks/code/code-indent';
import { codeBodyRange } from './blocks/code/code-renderer';
import { imageWidgetOnSelectedKey } from './image/image-widget-editing';
import TextEditableBlock from './blocks/text/TextEditableBlock.svelte';
import CodeBlock from './blocks/code/CodeBlock.svelte';
import ThematicBreakBlock from './blocks/ThematicBreakBlock.svelte';
import BlockquoteBlock from './blocks/BlockquoteBlock.svelte';
import ListBlock from './blocks/list/ListBlock.svelte';
import TableBlock from './blocks/table/TableBlock.svelte';
import { tableCellPasteSurface } from './blocks/table/table-cell-paste';
import { tableCaretAtPoint } from './blocks/table/table-caret-at-point';
import { tableDragHitTest } from './blocks/table/table-drag-hit-test';

function headingExtraProps(node: NodeView): Record<string, unknown> {
	if (shownKind(node) === 'paragraph') return { blockClass: 'paragraph-block' };
	const level = metadataOf(node, 'heading')?.level ?? 1;
	return { blockClass: `heading-${level}` };
}

const textAsRawBlock: BlockView = svelteBlockView(TextEditableBlock, () => ({
	blockClass: 'raw-block'
}));

// Stops a second call doing the work twice, without bypassing the registry: a
// dev-server re-evaluation resets it, so re-registering in dev still replaces.
let registered = false;

export function registerBuiltInBlocks(): void {
	if (registered) return;
	registered = true;

	// Descriptors first: augmentBuiltin('table') below needs `table` registered.
	registerBuiltInDescriptors();

	registerBlockView(
		'paragraph',
		svelteBlockView(TextEditableBlock, () => ({ blockClass: 'paragraph-block' }))
	);
	registerBlockView('heading', svelteBlockView(TextEditableBlock, headingExtraProps));
	registerBlockView('setextHeading', svelteBlockView(TextEditableBlock, headingExtraProps));
	registerBlockView('thematicBreak', svelteBlockView(ThematicBreakBlock));
	registerBlockView('fencedCode', svelteBlockView(CodeBlock));
	registerBlockView('blockquote', svelteBlockView(BlockquoteBlock));
	registerBlockView('list', svelteBlockView(ListBlock));
	registerBlockView('table', svelteBlockView(TableBlock));

	// Plain editable fallback for kinds with no rendered component. tableRow and tableCell
	// render inside TableBlock; these catch only strays that reach BlockHost directly.
	registerBlockView('indentedCode', textAsRawBlock);
	registerBlockView('htmlBlock', textAsRawBlock);
	registerBlockView('linkReferenceDefinition', textAsRawBlock);
	registerBlockView('tableRow', textAsRawBlock);
	registerBlockView('tableCell', textAsRawBlock);
	registerBlockView('unrecognized', textAsRawBlock);

	// The default loop in `paste/hooks.ts` skips `tableCell`, so registration order cannot
	// revert cell paste to the plain inline default.
	registerPasteSurface(tableCellPasteSurface);

	// A code block's emptiness is its body's, which the code renderer slices.
	augmentBuiltin('fencedCode', { bodyRange: codeBodyRange });

	// Table owns cell addressing: a drag needs the exact hit or a refusal, a caret the nearest
	// cell, and the selection code reaches both through the descriptor.
	augmentBuiltin('table', {
		foreignDragHitTest: tableDragHitTest,
		caretTargetAtPoint: tableCaretAtPoint
	});

	// Over a range, a code block shifts the body lines the range covers, as its own Tab does.
	registerBuiltInRangeIndent('fencedCode', 'code.indent', {
		lines: (node, range) => shiftBodyLines(node, range, 'indent')
	});
	registerBuiltInRangeIndent('fencedCode', 'code.dedent', {
		lines: (node, range) => shiftBodyLines(node, range, 'dedent')
	});

	// Image resize is editor-layer behavior, so the core image kind stays data-only
	// and gains its selected-key handler here, where the render layer is reachable.
	augmentInlineWidgetKind('image', { onSelectedKey: imageWidgetOnSelectedKey });
}
