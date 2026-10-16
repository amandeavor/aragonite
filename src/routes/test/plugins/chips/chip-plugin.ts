/**
 * `{{name}}` chips: a plugin widget that is drawn and never shows its source, so the caret selects
 * it whole, and that follows on the click the host picked (`claimsActivationClick`), so Mod+K
 * beside it reaches the widget too.
 */
import {
	definePlugin,
	declarePluginInlineKind,
	registerInlineSyntax,
	registerInlineWidgetKind,
	type EditorPlugin,
	type InlineNode
} from '#lib/plugin.js';
import { svelteView } from '#lib/svelte.js';
import Chip from './Chip.svelte';

export function chipsPlugin(): EditorPlugin {
	return definePlugin({
		name: 'harness-chips',
		setup() {
			const chip = declarePluginInlineKind('harness-chip');
			registerInlineSyntax('{', (raw, pos, end): InlineNode | null => {
				if (!raw.startsWith('{{', pos)) return null;
				const close = raw.indexOf('}}', pos + 2);
				if (close < 0 || close + 2 > end || raw.slice(pos + 2, close).includes('\n')) return null;
				return { kind: chip, start: pos, end: close + 2, children: [] };
			});
			registerInlineWidgetKind(chip, {
				isWidget: () => true,
				view: svelteView(Chip),
				editing: { claimsActivationClick: true }
			});
		}
	});
}
