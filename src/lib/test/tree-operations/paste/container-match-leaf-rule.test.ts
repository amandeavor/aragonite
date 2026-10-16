// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser';
import { serialize } from '../../../core/serializer';
import {
	makePasteCommit,
	registerStubBlockListState,
	dispatchPaste
} from '../../harness/editor-actions';
import { expectParseConverged } from '../../harness/parse-converged';

// The merge writes into the leaf before the fenced-code check, so the leaf's write rule applies.
// Miss-analysis: the container-match suite drove paragraph targets only, never another kind.

// A list item holding a code block whose last body line is one backtick short of a closer.
const ITEM_WITH_CODE = '- a\n\n  ```js\n  ``\n  code\n  ```\n';

async function pasteInto(source: string, targetPath: number[], text: string) {
	const h = makePasteCommit(source);
	registerStubBlockListState(h.doc.children[0]);
	await dispatchPaste(h, { pastedText: text, targetPath, offset: 8 }, { crossBlock: true });
	return h.doc;
}

describe('container-matching paste into a leaf with its own write rule', () => {
	it('grows the fence when the spliced item text completes a closer run', async () => {
		expect(parse(ITEM_WITH_CODE).children[0].children?.[0].children?.[1].kind).toBe('fencedCode');

		const doc = await pasteInto(ITEM_WITH_CODE, [0, 0, 1], '- `\n');

		expect(serialize(doc)).toContain('````js\n  ```\n  code\n  ````\n');
		expectParseConverged(doc);
	});

	it('leaves a splice that creates no closer alone', async () => {
		const doc = await pasteInto(ITEM_WITH_CODE, [0, 0, 1], '- z\n');

		expect(serialize(doc)).toContain('```js\n  ``z\n  code\n  ```\n');
		expectParseConverged(doc);
	});
});
