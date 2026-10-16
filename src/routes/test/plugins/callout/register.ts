/**
 * The callout plugin: the `:::callout` container model plus its component. The plugin unit
 * installs this setup once per process, so it runs unguarded and survives a schema reset.
 */

import { definePlugin, type EditorPlugin } from '#lib/plugin.js';
import { svelteBlockView } from '#lib/svelte.js';
import { registerCalloutKind } from './callout-kind';
import CalloutBlock from './CalloutBlock.svelte';

export function calloutPlugin(): EditorPlugin {
	return definePlugin({
		name: 'callout',
		setup: () => registerCalloutKind(svelteBlockView(CalloutBlock))
	});
}
