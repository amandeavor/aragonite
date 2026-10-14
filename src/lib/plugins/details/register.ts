/**
 * The plugin unit installs this setup once per process, so the registration runs
 * unguarded and re-registers cleanly after a schema reset.
 */

import { definePluginBlock, registerInsertEntry, type EditorPlugin } from '#lib/plugin.js';
import { svelteBlockView } from '#lib/svelte.js';
import { registerDetailsKind, DETAILS } from './details-kind';
import DetailsBlock from './DetailsBlock.svelte';

export function detailsPlugin(): EditorPlugin {
	return definePluginBlock({
		name: 'details',
		kind: DETAILS,
		view: svelteBlockView(DetailsBlock),
		register() {
			registerDetailsKind();
			registerInsertEntry({
				id: 'details',
				label: 'Details',
				icon: 'chevron-right',
				keywords: ['toggle', 'collapsible', 'disclosure', 'summary', 'expand'],
				markdown: '<details>\n<summary></summary>\n\n</details>\n'
			});
		}
	});
}
