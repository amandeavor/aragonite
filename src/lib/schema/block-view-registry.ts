/**
 * Runtime `BlockKind → view` map. BlockHost looks up by kind; plugin kinds register a descriptor
 * plus a view. A view is opaque here so this module's types name no UI framework.
 */

import { isBuiltinBlockKind, type AnyBlockKind } from '../core/nodes';
import type { PluginActivation } from './plugin-activation';
import {
	installedPlugin,
	pluginEditorFor,
	resolvePluginOptions,
	type EditorContext
} from './plugin-install';
import { createBlockKindRegistry } from './plugin-registry';

declare const blockViewBrand: unique symbol;

/** What draws a block kind: `svelteBlockView` (from `@voithos-labs/aragonite/svelte`) makes one. */
export interface BlockView {
	readonly [blockViewBrand]: true;
}

const registry = createBlockKindRegistry<BlockView>({
	label: 'registerBlockView',
	isBuiltin: isBuiltinBlockKind
});

export function registerBlockView(kind: AnyBlockKind, view: BlockView): void {
	registry.register(
		kind,
		view,
		`registerBlockView: "${kind}" is already registered. Views are register-once.`
	);
}

/** The kind's view where `activation` resolves the plugin that owns the kind. */
export function getBlockView(
	kind: AnyBlockKind,
	activation: PluginActivation
): BlockView | undefined {
	return registry.get(kind, activation);
}

/** An editor's `EditorContext` for the plugin the kind's component answers to, which is the
 *  context the component's `getEditor` reads. */
export function componentPluginEditor(
	pluginEditor: ((pluginName: string) => EditorContext | undefined) | undefined,
	kind: AnyBlockKind
): EditorContext | undefined {
	return pluginEditorFor(pluginEditor, registry.ownerOf(kind));
}

/** The options the kind's component reads: its editor's, or the owning plugin's `defaults` when
 *  no editor is mounted, resolved as an editor with no entry for the plugin would. */
export function componentPluginOptions(
	pluginEditor: ((pluginName: string) => EditorContext | undefined) | undefined,
	kind: AnyBlockKind
): unknown {
	const editor = componentPluginEditor(pluginEditor, kind);
	if (editor) return editor.options;
	const owner = installedPlugin(registry.ownerOf(kind) ?? '') ?? {};
	return resolvePluginOptions(owner, undefined);
}

/** `registerBlockView` throws on a duplicate, so a plugin that may register twice (hot reload,
 *  re-import) checks this first. */
export function isBlockViewRegistered(kind: string): boolean {
	return registry.has(kind as AnyBlockKind);
}
