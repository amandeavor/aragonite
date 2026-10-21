// A keystroke looks up the body for a construct it could finish only when it wrote a line that
// could finish one, and then walks once, whatever the number of openers.
// Miss-analysis: the closer two blocks below (#684) needed a walk up the body, and no row said
// which keystrokes pay for it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { docPathFrom } from '#lib/caret/coordinate-spaces.js';
import { createUndoController } from '#lib/editor-actions/commit/undo-controller.js';
import { createLeafTyping } from '#lib/editor-actions/leaf-write.js';
import { legalizeWrite } from '#lib/tree-operations/content-write.js';
import { makeEditorActionsDeps } from '#lib/test/harness/editor-actions.js';
import { installPlugins } from '#lib';
import { latexPlugin } from '#lib/plugins/latex/index.js';
import { admonitionsPlugin } from '#lib/plugins/admonitions/index.js';
import { detailsPlugin } from '#lib/plugins/details/index.js';
import {
	disablePerfInstruments,
	enablePerfInstruments,
	perfSnapshot,
	resetPerfInstruments
} from '#lib/perf/instruments.js';

const BLOCKS = 5000;
const BODY = Array.from({ length: BLOCKS }, (_, i) => `paragraph ${i}\n`).join('\n');

/** The walks and the blocks they read when `text` is written over the last block in place. */
function walkOf(text: string): { walks: number; blocks: number } {
	const { deps } = makeEditorActionsDeps(BODY);
	const typing = createLeafTyping(deps, createUndoController(deps));
	const last = deps.doc.children.length - 1;
	const write = legalizeWrite(deps.doc, last, text, 'authored');
	enablePerfInstruments();
	resetPerfInstruments();
	expect(typing.writeLeafInPlace(docPathFrom([last]), write, 0).wrote).toBe(true);
	const { unfinishedWalks, unfinishedBlocksAsked } = perfSnapshot();
	return { walks: unfinishedWalks, blocks: unfinishedBlocksAsked };
}

beforeEach(() => {
	installPlugins([latexPlugin(), admonitionsPlugin(), detailsPlugin()]);
	resetPerfInstruments();
});
afterEach(() => disablePerfInstruments());

describe('the walk for a construct a keystroke could finish, over a 5,000-block body', () => {
	it('a letter that closes nothing reads no block above', () => {
		expect(walkOf(`paragraph ${BLOCKS - 1}x\n`)).toEqual({ walks: 0, blocks: 0 });
	});

	it.each(['$$', ':::', '</details>'])('a `%s` line walks the body once', (closer) => {
		expect(walkOf(`paragraph\n${closer}\n`)).toEqual({ walks: 1, blocks: BLOCKS - 1 });
	});
});
