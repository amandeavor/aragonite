// Plugin views for suites that only need something drawn: each appends what `build` returns.
import type { PluginView } from '#lib/plugin-view.js';

export function appendView<P>(build: () => HTMLElement = () => document.createElement('span')) {
	const view: PluginView<P> = (target) => {
		target.append(build());
		return {};
	};
	return view;
}
