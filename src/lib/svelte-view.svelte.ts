/**
 * A Svelte component as a plugin view: mounted into the element the editor makes for it, with the
 * slot's props live, so `update` re-renders only what reads a changed prop.
 */

import { mount, unmount, type Component } from 'svelte';
import type { PluginView } from './plugin-view';

/** A view drawn by `component`; it fits any slot whose props include the ones it declares. */
export function svelteView<P extends object>(component: Component<P>): PluginView<P> {
	return (target, initial) => {
		let current = initial;
		const keys = Object.keys(initial) as (keyof P & string)[];
		// One counter per prop, bumped only when that prop changes, so a widget moved by typing
		// doesn't re-render what reads only its `source`.
		const versions: Record<string, number> = $state(Object.fromEntries(keys.map((k) => [k, 0])));
		// Each prop reads through to the latest props object, so a getter the slot passes (an
		// inline widget's `computeInlineContent`) stays live instead of copied once.
		const props = {} as P;
		for (const key of keys) {
			Object.defineProperty(props, key, {
				enumerable: true,
				get: () => {
					void versions[key];
					return current[key];
				}
			});
		}
		const instance = mount(component, { target, props });
		return {
			update(next) {
				const previous = current;
				current = next;
				for (const key of keys) if (!Object.is(previous[key], next[key])) versions[key]++;
			},
			destroy: () => unmount(instance)
		};
	};
}
