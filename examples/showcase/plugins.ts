/**
 * The showcase's plugins on the installed package, for the React and Vue showcases. The Svelte
 * showcase runs the same list on repo source (`src/routes/demo-plugins.ts`), and
 * `showcase-plugin-parity.test.ts` holds the two lists to the same plugins in the same order.
 */

import { definePlugin, type EditorPlugin } from '@voithos-labs/aragonite/plugin';
import { admonitionsPlugin } from '@voithos-labs/aragonite/plugins/admonitions';
import { detailsPlugin } from '@voithos-labs/aragonite/plugins/details';
import { tocPlugin } from '@voithos-labs/aragonite/plugins/toc';
import { footnotesPlugin } from '@voithos-labs/aragonite/plugins/footnotes';
import { emojiPlugin } from '@voithos-labs/aragonite/plugins/emoji';
import { highlightOccurrencesPlugin } from '@voithos-labs/aragonite/plugins/highlight-occurrences';
import { latexPlugin } from '@voithos-labs/aragonite/plugins/latex';
import { katexRenderer } from '@voithos-labs/aragonite/plugins/latex/renderer';
import { mermaidPlugin } from '@voithos-labs/aragonite/plugins/mermaid';
import { mermaidRenderer } from '@voithos-labs/aragonite/plugins/mermaid/renderer';
import { parrotPlugin } from '@voithos-labs/aragonite/plugins/parrot';
import { slashCommandsPlugin } from '@voithos-labs/aragonite/plugins/slash-commands';
import { installTagMarks } from './tag-marks';

function tagMarksPlugin(): EditorPlugin {
	return definePlugin({
		name: 'harness-tag-marks',
		setup(ctx) {
			ctx.onEditor((editor) => installTagMarks(editor));
		}
	});
}

const ALL_PLUGINS = [
	admonitionsPlugin(),
	detailsPlugin(),
	tocPlugin(),
	footnotesPlugin(),
	emojiPlugin(),
	highlightOccurrencesPlugin(),
	latexPlugin({ renderer: katexRenderer }),
	mermaidPlugin({ renderer: mermaidRenderer }),
	parrotPlugin(),
	slashCommandsPlugin(),
	tagMarksPlugin()
];

// Definitions are process-global, so both sets hold the same plugin objects and the occurrences
// toggle only changes which of them the remounted editor activates.
const WITHOUT_OCCURRENCES = ALL_PLUGINS.filter((plugin) => plugin.name !== 'highlight-occurrences');

/** The plugins an editor mounts with; the occurrences toggle adds the word highlighter. */
export function showcasePlugins(occurrences: boolean): readonly EditorPlugin[] {
	return occurrences ? ALL_PLUGINS : WITHOUT_OCCURRENCES;
}
