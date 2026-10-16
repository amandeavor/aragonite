/** The memo plugin: the plain-mode check on `createEditableLeaf`; see memo-kind.ts. */

import { definePlugin, type EditorPlugin } from '#lib/plugin.js';
import { svelteBlockView } from '#lib/svelte.js';
import { registerMemoBlock } from './memo-kind';
import MemoBlock from './MemoBlock.svelte';

export function memoPlugin(): EditorPlugin {
	return definePlugin({
		name: 'memo',
		setup: () => registerMemoBlock(svelteBlockView(MemoBlock))
	});
}
