/** The plugin a block kind's component answers to: the editor context and options it reads. */

import type { AnyBlockKind } from '../core/nodes';
import { blockKindOwner } from './block-kind-descriptor';
import {
	installedPlugin,
	pluginEditorFor,
	resolvePluginOptions,
	type EditorContext
} from './plugin-install';

/** An editor's `EditorContext` for the plugin that owns the kind, which is the context the kind's
 *  component reads through `getEditor`. */
export function componentPluginEditor(
	pluginEditor: ((pluginName: string) => EditorContext | undefined) | undefined,
	kind: AnyBlockKind
): EditorContext | undefined {
	return pluginEditorFor(pluginEditor, blockKindOwner(kind));
}

/** The options the kind's component reads: its editor's, or the owning plugin's `defaults` when
 *  no editor is mounted, resolved as an editor with no entry for the plugin would. */
export function componentPluginOptions(
	pluginEditor: ((pluginName: string) => EditorContext | undefined) | undefined,
	kind: AnyBlockKind
): unknown {
	const editor = componentPluginEditor(pluginEditor, kind);
	if (editor) return editor.options;
	const owner = installedPlugin(blockKindOwner(kind) ?? '') ?? {};
	return resolvePluginOptions(owner, undefined);
}
