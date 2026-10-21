/**
 * Puts an editable leaf's spread bundle on an element a view made, as `<div {...props}>` would:
 * every `on…` key a listener, every other string key an attribute, every symbol key an attachment.
 * Nothing here names a handler, so a key the bundle gains is wired too. Call during component init.
 */

import { untrack } from 'svelte';
import { on } from 'svelte/events';

export interface LeafSurfaceBinding {
	getEl(): HTMLElement | null;
	/** Read on each use: the bundle is rebuilt as the attributes change. */
	props(): Record<string | symbol, unknown>;
	/** Runs after the bundle's own `input` listener. */
	afterInput?(el: HTMLElement, e: Event): void;
}

export function bindLeafSurface(binding: LeafSurfaceBinding): void {
	bindAttributes(binding);
	bindListeners(binding);
	for (const key of Object.getOwnPropertySymbols(untrack(binding.props))) {
		bindAttachment(binding, key);
	}
}

const isListener = (key: string, value: unknown): value is EventListener =>
	key.startsWith('on') && typeof value === 'function';

// One effect for every attribute, re-run as the bundle's reads change (reading mode, the menu).
function bindAttributes(binding: LeafSurfaceBinding): void {
	let applied = new Set<string>();
	let appliedTo: HTMLElement | null = null;
	$effect(() => {
		const el = binding.getEl();
		if (el !== appliedTo) applied = new Set();
		appliedTo = el;
		if (!el) return;
		const next = new Set<string>();
		for (const [key, value] of Object.entries(binding.props())) {
			if (isListener(key, value)) continue;
			// Svelte's own rule: only an absent value removes the attribute.
			if (value === undefined || value === null) continue;
			// Only a changed value is written: re-setting `contenteditable` drops the element's focus.
			if (el.getAttribute(key) !== String(value)) el.setAttribute(key, String(value));
			next.add(key);
		}
		for (const key of applied) if (!next.has(key)) el.removeAttribute(key);
		applied = next;
	});
}

// Through `on`, which keeps Svelte's delegated event order; the bundle's handlers never change.
function bindListeners(binding: LeafSurfaceBinding): void {
	$effect(() => {
		const el = binding.getEl();
		if (!el) return;
		const offs: (() => void)[] = [];
		for (const [key, value] of Object.entries(untrack(binding.props))) {
			if (!isListener(key, value)) continue;
			if (key.endsWith('capture')) {
				throw new Error(`bindLeafSurface: no capture listener is bound, and the bundle has ${key}`);
			}
			offs.push(on(el, key.slice(2), value));
		}
		const after = binding.afterInput;
		if (after) offs.push(on(el, 'input', (e) => after(el, e)));
		return () => offs.forEach((off) => off());
	});
}

// Its own effect per key, behind a derived of the function, so rebuilding the attributes never
// re-runs an attachment whose function stayed the same.
function bindAttachment(binding: LeafSurfaceBinding, key: symbol): void {
	const attachment = $derived(binding.props()[key]);
	$effect(() => {
		const el = binding.getEl();
		const attach = attachment;
		if (!el || typeof attach !== 'function') return;
		return (attach as (el: HTMLElement) => void | (() => void))(el);
	});
}
