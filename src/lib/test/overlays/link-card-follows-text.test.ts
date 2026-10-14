// @vitest-environment jsdom
// Miss-analysis: the overlay rows covered marks and the selection paint, never the link card,
// which shares their measure wiring but was left off the moved-text reports.
import { describe, it, expect, afterEach } from 'vitest';
import { tick } from 'svelte';
import { parse } from '#lib/core/parser.js';
import { createUndoController } from '#lib/editor-actions/commit/undo-controller.js';
import { createInlineRangeCommit } from '#lib/editor-actions/inline-range-commit.js';
import { createLinkCardCommitter } from '#lib/components/link-card/link-card-commit.js';
import { createTextMoves } from '#lib/components/overlays/text-moves.js';
import { makeEditorActionsDeps } from '#lib/test/harness/editor-actions.js';
import { fixtureReading } from '../harness/fixture-grammar';

afterEach(() => {
	document.body.replaceChildren();
});

describe('link card position', () => {
	it('measures again when text moves everywhere, as a theme or font change reports', async () => {
		const harness = makeEditorActionsDeps(parse('see link here\n').children);
		const editorEl = document.createElement('div');
		const cardEl = document.createElement('div');
		editorEl.append(cardEl);
		document.body.append(editorEl);
		let linkLeft = 40;
		const textMoves = createTextMoves();
		const committer = createLinkCardCommitter({
			getDoc: () => harness.doc,
			getEditorEl: () => editorEl,
			getTarget: () => null,
			getCreateTarget: () => ({ path: [0], start: 4, end: 8 }),
			inlineRange: createInlineRangeCommit({
				deps: harness.deps,
				controller: createUndoController(harness.deps)
			}),
			events: harness.events,
			measureRange: () => [new DOMRect(linkLeft, 10, 30, 16)],
			reading: fixtureReading(),
			textMoves
		});

		const stop = committer.syncCardToLink(() => cardEl);
		const before = parseFloat(cardEl.style.left);

		linkLeft = 72;
		textMoves.movedEverywhere();
		await tick();
		stop();

		expect(parseFloat(cardEl.style.left) - before).toBe(32);
	});
});
