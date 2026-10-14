/**
 * Turns on the `:::name` directive syntax: the grammar plus the generic container and leaf
 * components. Exported from `@voithos-labs/aragonite/plugin`; a consumer that never calls it
 * leaves `:::` as ordinary text. Lives in `components/` because it binds Svelte components,
 * which core may not import. Each registration checks first, so calling this twice is safe.
 */

import { activateDirectiveGrammar } from '#lib/core/directive/activate.js';
import { registerBlockView, isBlockViewRegistered } from '#lib/schema/block-view-registry.js';
import { svelteBlockView } from '#lib/components/svelte-block-view.js';
import { declaredPluginKind } from '#lib/schema/plugin-kind.js';
import { registerAsCore } from '#lib/schema/plugin-install.js';
import { DIRECTIVE_CONTAINER, DIRECTIVE_LEAF } from '#lib/core/directive/kinds.js';
import DirectiveContainerBlock from './DirectiveContainerBlock.svelte';
import TextEditableBlock from '../text/TextEditableBlock.svelte';

export function activateDirectives(): void {
	// The shared directive kinds and their components belong to no plugin, whichever plugin's setup
	// turns directives on, so an editor that left that plugin out still reads `:::name` as generic.
	registerAsCore(() => {
		activateDirectiveGrammar();

		if (!isBlockViewRegistered(DIRECTIVE_CONTAINER)) {
			registerBlockView(
				declaredPluginKind(DIRECTIVE_CONTAINER),
				svelteBlockView(DirectiveContainerBlock)
			);
		}

		// The leaf's kind descriptor already drives its dimmed marker and split behavior, so it
		// reuses the built-in text block component as is.
		if (!isBlockViewRegistered(DIRECTIVE_LEAF)) {
			registerBlockView(
				declaredPluginKind(DIRECTIVE_LEAF),
				svelteBlockView(TextEditableBlock, () => ({ blockClass: 'directive-leaf' }))
			);
		}
	});
}
