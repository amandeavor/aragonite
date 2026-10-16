/**
 * The editor mounted into an element, for a host that doesn't compile Svelte (React, Vue, Angular,
 * plain DOM). Props live in one reactive object that `update` writes into, skipping the options
 * `EDITOR_OPTION_SPECS` marks as read at mount, so a host may pass every option again on each render.
 */

import { createRawSnippet, mount, unmount, type Snippet } from 'svelte';
import Editor from './components/Editor.svelte';
import { EDITOR_OPTION_SPECS, type EditorInstance, type EditorOptions } from './editor-props';
import type { EditorProps } from './components/editor-component-props';
import { createReactiveProps } from './reactive-props';
import { devWarn } from './dev-warn';

// ── Public API ──────────────────────────────────────────────────────────────

/** The editor's options, with the header as an element of your own. */
export type CreateEditorOptions = EditorOptions & {
	/** Shown above the first block, inside the editor's scroll container; `null` removes it. */
	header?: HTMLElement | null;
};

/** The mounted editor's methods, plus the two a Svelte host gets from the component itself. */
export interface EditorHandle extends EditorInstance {
	/** New values for any options: an unchanged one does nothing, `undefined` clears one (`source`
	 *  keeps the document), and the mount-only `plugins`, `syntax` and `scrollMode` are ignored. */
	update(options: Partial<CreateEditorOptions>): void;
	/** Unmounts the editor, taking out of `target` what it added; a second call does nothing. */
	destroy(): void;
}

/** Mounts an editor into `target` and returns its handle. Call `destroy` before dropping `target`. */
export function createEditor(target: HTMLElement, options: CreateEditorOptions = {}): EditorHandle {
	const initial: Record<string, unknown> = {};
	for (const key of propKeys(options)) initial[key] = propValue(key, options[key]);
	const props = createReactiveProps(initial as EditorProps);
	if (occupiedTargets.has(target)) {
		devWarn('target-occupied', 'createEditor: the target still holds an editor; destroy it first');
	}
	occupiedTargets.add(target);
	const instance = mount(Editor, { target, props });
	let mounted = true;
	return {
		...instance,
		update(next) {
			for (const key of propKeys(next)) {
				if (EDITOR_OPTION_SPECS[key].timing === 'once') continue;
				(props as Record<string, unknown>)[key] = propValue(key, next[key]);
			}
		},
		destroy() {
			if (!mounted) return;
			mounted = false;
			occupiedTargets.delete(target);
			void unmount(instance);
		}
	};
}

// ── Internal ────────────────────────────────────────────────────────────────

// Targets whose editor isn't destroyed yet; a second mount there stacks two editors (G1.94).
const occupiedTargets = new WeakSet<HTMLElement>();

// Presence is an own key, so `{ placeholder: undefined }` clears the prop.
function propKeys(options: Partial<CreateEditorOptions>): (keyof EditorProps)[] {
	return Object.keys(options).filter((key): key is keyof EditorProps =>
		Object.hasOwn(EDITOR_OPTION_SPECS, key)
	);
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
