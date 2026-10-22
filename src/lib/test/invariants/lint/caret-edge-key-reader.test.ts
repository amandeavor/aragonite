/**
 * A caret-edge key is read in one place, `caretEdgeKey` in `schema/keybindings.ts`, which knows
 * both spellings: Home and End with their modifiers, and macOS's Cmd+Arrow (G4.227). A site that
 * compares Home or End itself would answer the one spelling and miss Cmd+Arrow. PageUp and
 * PageDown are read the same way, by `pageKey`, which leaves the browser the chords it keeps.
 */

// Miss-analysis: five edge sites each compared Home or End, so Cmd+Arrow on macOS reached none of
// them; every suite pressed Home and End, and the one macOS run read Home as a scroll.

import { collectEditorSources } from './scan-source';
import { describeManifests } from './file-rule';

const home = 'Ho' + 'me';
const end = 'E' + 'nd';
const pageDown = 'Page' + 'Down';

describeManifests(
	[
		{
			id: 'G4.227 a caret-edge or page key is read by its reader alone',
			matches:
				/\bkey\s*[!=]==\s*['"](?:Home|End|PageUp|PageDown)['"]|\bcase\s*['"](?:Home|End|PageUp|PageDown)['"]\s*:/,
			declared: {
				'src/lib/schema/keybindings.ts': 'caretEdgeKey and pageKey, the readers',
				'src/lib/caret/edge-affinity.ts':
					"a key's class for the caret memory, where an arrow and Home are both a move",
				'src/lib/components/blocks/table/TableActionMenu.svelte':
					"the open menu's first and last item, not a caret edge"
			},
			reason:
				'read the key with caretEdgeKey (schema/keybindings.ts), which also reads Cmd+Arrow, the macOS spelling, or a page key with pageKey',
			hits: [
				`if (e.key === '${home}') return;`,
				`if (e.key !== '${end}' && x) return;`,
				`switch (e.key) { case '${end}': break; }`,
				`const side = e.key === '${pageDown}' ? 'end' : null;`
			],
			misses: [
				"const edge = caretEdgeKey(e);\nif (edge?.to === 'line') return;",
				`const label = '${home}';`
			]
		}
	],
	collectEditorSources()
);
