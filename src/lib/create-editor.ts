/**
 * The editor mounted into an element, for a host that doesn't compile Svelte (React, Vue, Angular,
 * plain DOM). Props live in one reactive object that `update` writes into, skipping the props
 * `EDITOR_PROP_TIMING` reads at mount only, so a host may pass every option again on each render.
 */

import { createRawSnippet, mount, unmount, type Snippet } from 'svelte';
import Editor from './components/Editor.svelte';
import { EDITOR_PROP_TIMING, type EditorInstance, type EditorProps } from './editor-props';
import { createReactiveProps } from './reactive-props';

// ── Public API ──────────────────────────────────────────────────────────────

/** `EditorProps`, with the header as an element of your own instead of a Svelte snippet. */
export type CreateEditorOptions = Omit<EditorProps, 'header'> & {
	/** Shown above the first block, inside the editor's scroll container; `null` removes it. */
	header?: HTMLElement | null;
};

/** The mounted editor's methods, plus the two a Svelte host gets from the component itself. */
export interface EditorHandle extends EditorInstance {
	/** New values for any options. An unchanged value does nothing, a key passed as `undefined`
	 *  clears it, and `plugins`, `syntax` and `scrollMode`, read at mount only, are ignored. */
	update(options: Partial<CreateEditorOptions>): void;
	/** Unmounts the editor and empties `target`; a second call does nothing. */
	destroy(): void;
}

/**
 * Mounts an editor into `target` and returns its handle. The options are `EditorProps`, with
 * `header` as an element. Call `destroy` before dropping `target`.
 */
export function createEditor(target: HTMLElement, options: CreateEditorOptions = {}): EditorHandle {
	const initial: Record<string, unknown> = {};
	for (const key of propKeys(options)) initial[key] = propValue(key, options[key]);
	const props = createReactiveProps(initial as EditorProps);
	const instance = mount(Editor, { target, props });
	let mounted = true;
	return {
		...instance,
		update(next) {
			for (const key of propKeys(next)) {
				if (EDITOR_PROP_TIMING[key] === 'once') continue;
				(props as Record<string, unknown>)[key] = propValue(key, next[key]);
			}
		},
		destroy() {
			if (!mounted) return;
			mounted = false;
			void unmount(instance);
		}
	};
}

// ── Internal ────────────────────────────────────────────────────────────────

// Presence is tested with `in`, so `{ placeholder: undefined }` clears the prop.
function propKeys(options: Partial<CreateEditorOptions>): (keyof EditorProps)[] {
	return Object.keys(options).filter((key): key is keyof EditorProps => key in EDITOR_PROP_TIMING);
}

function propValue(key: keyof EditorProps, value: unknown): unknown {
	return key === 'header' ? headerSnippet(value as HTMLElement | null | undefined) : value;
}

// One snippet per element, so passing the same header again is an unchanged value.
const headerSnippets = new WeakMap<HTMLElement, Snippet>();

function headerSnippet(el: HTMLElement | null | undefined): Snippet | undefined {
	if (!el) return undefined;
	let snippet = headerSnippets.get(el);
	if (!snippet) {
		snippet = createRawSnippet(() => ({
			render: () => '<div></div>',
			setup: (holder) => void holder.append(el)
		}));
		headerSnippets.set(el, snippet);
	}
	return snippet;
}
