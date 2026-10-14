/**
 * A props object for Svelte's `mount` that a host writes the way a parent component passes props:
 * each key is its own signal, so writing one wakes only its readers, and an equal value wakes
 * none. Values are stored as given, never deep-proxied, so a plugin keeps its identity.
 */

import { SvelteMap } from 'svelte/reactivity';

export function createReactiveProps<P extends object>(initial: P): P {
	const values = new SvelteMap<PropertyKey, unknown>(Object.entries(initial));
	return new Proxy({} as P, {
		get: (_, key) => values.get(key),
		set: (_, key, value) => {
			values.set(key, value);
			return true;
		},
		has: (_, key) => values.has(key),
		ownKeys: () =>
			[...values.keys()].filter((key) => typeof key !== 'number') as (string | symbol)[],
		getOwnPropertyDescriptor: (_, key) =>
			values.has(key)
				? { value: values.get(key), writable: true, enumerable: true, configurable: true }
				: undefined
	});
}
