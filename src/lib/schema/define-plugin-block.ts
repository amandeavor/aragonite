/**
 * The one-block plugin shortcut: declare and describe a kind, then attach its view, so a
 * single-kind plugin does not have to wrap `definePlugin` itself and get the setup order right. A
 * plugin with several kinds uses `definePlugin` directly. `kind` is the plain declared name,
 * branded after `register` runs: `declaredPluginKind` throws for a name not yet declared.
 */

import { definePlugin, type EditorPlugin } from './plugin-install';
import { declaredPluginKind } from './plugin-kind';
import { registerBlockView, type BlockView } from './block-view-registry';

export function definePluginBlock<Options extends object = Record<never, never>>(config: {
	name: string;
	kind: string;
	view: BlockView;
	register: () => void;
	defaults?: Options;
	parseOptions?(raw: unknown): Partial<Options>;
}): EditorPlugin<Options> {
	return definePlugin<Options>({
		name: config.name,
		defaults: config.defaults,
		parseOptions: config.parseOptions,
		setup() {
			config.register();
			registerBlockView(declaredPluginKind(config.kind), config.view);
		}
	});
}
