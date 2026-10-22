// A one-line plugin leaf whose metadata is one flag its bytes spell (`%%!` tagged, `%%` not), with
// `Mod+Shift+K` bound to the command that tags it by rewriting the bytes.

import {
	definePlugin,
	registerBlockCommand,
	setPluginMetadata,
	type CstNode,
	type EditorPlugin
} from '#lib/plugin.js';
import { svelteBlockView } from '#lib/svelte.js';
import { testLeaf } from '#lib/test/harness/test-kinds.js';
import PlainOneLineLeafBlock from './PlainOneLineLeafBlock.svelte';
import RevealLeafBlock from './RevealLeafBlock.svelte';

export const TAG_KEY: KeyboardEventInit = { key: 'K', ctrlKey: true, shiftKey: true };

/** The tag leaf in either editable-leaf mode: `plain` keeps its source mounted, `reveal` shows it
 *  only while focused. */
export function tagLeafPlugin(mode: 'plain' | 'reveal' = 'plain'): EditorPlugin {
	return definePlugin({
		name: `tag-leaf-${mode}`,
		setup: () => {
			testLeaf(`tag-leaf-${mode}`, (kind) => {
				const tag = registerBlockCommand(kind, 'tagLeaf.tag', (ctx) => {
					if (ctx.node.raw.startsWith('%%!')) return false;
					ctx.replaceRaw(`%%!${ctx.node.raw.slice(2)}`);
					return true;
				});
				return {
					opener: {
						priority: 25,
						interruptsParagraph: false,
						tryOpen: (ctx) => {
							if (!ctx.line.text.startsWith('%%')) return null;
							const node: CstNode = { kind, leadingTrivia: ctx.leadingTrivia, raw: ctx.line.raw };
							if (ctx.line.text.startsWith('%%!')) setPluginMetadata(node, { tagged: true });
							return { node, consumed: 1 };
						}
					},
					view: svelteBlockView(mode === 'plain' ? PlainOneLineLeafBlock : RevealLeafBlock),
					keymap: [{ chord: 'Mod+Shift+K', command: tag }]
				};
			});
		}
	});
}
