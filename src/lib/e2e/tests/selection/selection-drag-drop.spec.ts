import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { blockCenter, pastLineEnd } from './multi-click-helpers';
import { pointAtRaw, textOutsideMarkers, textRunCenter, textRunStart } from '../../text-runs';
import { multiClick } from '../../multi-click';
import { dragSelection } from '../../selection-drag';
import { COPY_DRAG_MODIFIERS, edgeKey } from '../../platform-keys';
import { skipUnlessSupported } from '../../browser-engine';

// Dragging a selection and dropping it (`requirements/selection/selection-drag-drop.md`). Drops
// aim past a line's end or at its first glyph: the two points whose offset no font metric moves.

const TWO = 'alpha beta gamma\n\nsecond para here\n';
const COPIED = 'alpha beta gamma\n\nbetasecond para here\n';

type Point = { x: number; y: number };

function converged(page: import('@playwright/test').Page): Promise<boolean> {
	return page.evaluate(() => (window as any).__test.parseConverged());
}

/** A fresh document has nothing to undo, so a Ctrl+Z that still leaves `expected` says both that
 *  the declined gesture put no entry on the undo stack and that it wrote nothing. */
async function undoLeavesDocument(editor: EditorPage, expected: string): Promise<void> {
	await editor.pressDeclined('ControlOrMeta+z');
	expect(await editor.page.evaluate(() => (window as any).__test.getSource())).toBe(expected);
}

/** One top-level block's own bytes: the read that says whether a payload left its source, where a
 *  whole-document diff only implies it. */
function blockRaw(page: import('@playwright/test').Page, index: number): Promise<string> {
	return page.evaluate(
		(i) => String((window as any).__test.getDocument().children[i]?.raw ?? ''),
		index
	);
}

/** A table cell's rendered text beside its own raw: the cell is the editable element, so the
 *  block-level read above would compare one cell's DOM against the whole table's bytes. */
function cellMatchesRaw(
	page: import('@playwright/test').Page,
	row: number,
	col: number
): Promise<boolean> {
	return page.evaluate(
		([r, c]) => {
			const rowEl = document.querySelector(`[data-table-row-idx='${r}']`);
			const cell = rowEl?.querySelectorAll(':scope > .table-cell')[c];
			const table = (window as any).__test.getDocument().children[0];
			return cell?.textContent === String(table?.children?.[r]?.children?.[c]?.raw ?? '');
		},
		[row, col]
	);
}

/** The top-level block's rendered text beside its raw: in source mode they are the same string,
 *  so a native edit the editor never saw shows here where a tree-only read would miss it. */
function domMatchesRaw(page: import('@playwright/test').Page, index: number): Promise<boolean> {
	return page.evaluate((i) => {
		const host = document.querySelector(`[data-block-path='[${i}]']`);
		const surface = host?.querySelector('[contenteditable="true"]') ?? host;
		const raw = String((window as any).__test.getDocument().children[i]?.raw ?? '');
		return surface?.textContent === raw.replace(/\r?\n$/, '');
	}, index);
}

test.describe('dragging a selection', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(TWO);
	});

	async function doubleClickOn(needle: string): Promise<Point> {
		const at = await textRunCenter(editor.page, needle);
		await multiClick(editor.page, at, 2);
		return at;
	}

	test('a word dropped at the end of its own paragraph moves there', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		await dragSelection(page, beta, await pastLineEnd(page, 'gamma'));
		await editor.bridge.waitForSourceEquals('alpha  gammabeta\n\nsecond para here\n');
		expect(await converged(page)).toBe(true);
		expect(await domMatchesRaw(page, 0)).toBe(true);
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals(TWO);
		await page.keyboard.press('ControlOrMeta+y');
		await editor.bridge.waitForSourceEquals('alpha  gammabeta\n\nsecond para here\n');
	});

	test('a word dropped in another paragraph moves there', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		await dragSelection(page, beta, await textRunStart(page, 'second para here'));
		await editor.bridge.waitForSourceEquals('alpha  gamma\n\nbetasecond para here\n');
		expect(await converged(page)).toBe(true);
		expect(await domMatchesRaw(page, 0)).toBe(true);
		expect(await domMatchesRaw(page, 1)).toBe(true);
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals(TWO);
	});

	for (const modifier of COPY_DRAG_MODIFIERS) {
		test(`a word released with ${modifier} held is copied, the source kept`, async ({ page }) => {
			skipUnlessSupported(page, 'modifierDrop');
			const beta = await doubleClickOn('beta');
			const target = await textRunStart(page, 'second para here');
			await dragSelection(page, beta, target, { copyWith: modifier });
			await editor.bridge.waitForSourceEquals(COPIED);
			expect(await converged(page)).toBe(true);
			expect(await domMatchesRaw(page, 0)).toBe(true);
			expect(await domMatchesRaw(page, 1)).toBe(true);
			await page.keyboard.press('ControlOrMeta+z');
			await editor.bridge.waitForSourceEquals(TWO);
			await page.keyboard.press('ControlOrMeta+y');
			await editor.bridge.waitForSourceEquals(COPIED);
		});
	}

	test("the block inline syntax handler's content moves and leaves the block behind", async ({
		page
	}) => {
		const at = await textRunCenter(page, 'beta');
		await multiClick(page, at, 3);
		await dragSelection(page, at, await textRunStart(page, 'second para here'));
		await editor.bridge.waitForSource((s) => s.endsWith('alpha beta gammasecond para here\n'));
		expect(await page.evaluate(() => (window as any).__test.getBlockCount())).toBe(2);
		expect(await converged(page)).toBe(true);
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals(TWO);
	});

	test('a Shift+Arrow selection drags the same way', async ({ page }) => {
		const beta = await textRunCenter(page, 'beta');
		await page.mouse.click(beta.x, beta.y);
		await page.keyboard.press(edgeKey('lineStart'));
		for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
		for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
		await dragSelection(page, beta, await textRunStart(page, 'second para here'));
		await editor.bridge.waitForSourceEquals('alpha  gamma\n\nbetasecond para here\n');
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals(TWO);
	});

	test("a word dragged out of a code body takes the body's own bytes", async ({ page }) => {
		await editor.loadContent('```\nconst value = 1\n```\n\nsecond para here\n');
		await doubleClickOn('value');
		await dragSelection(
			page,
			await textRunCenter(page, 'value'),
			await textRunStart(page, 'second para')
		);
		await editor.bridge.waitForSourceEquals('```\nconst  = 1\n```\n\nvaluesecond para here\n');
		expect(await converged(page)).toBe(true);
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals('```\nconst value = 1\n```\n\nsecond para here\n');
	});

	const CELL_DOC = '| a | b |\n| --- | --- |\n| alpha beta gamma | zed |\n\nsecond para here\n';
	const CELL_MOVED = '| a | b |\n| --- | --- |\n| alpha  gamma | zed |\n\nbetasecond para here\n';

	test('a word dragged out of a table cell moves to the drop point', async ({ page }) => {
		await editor.loadContent(CELL_DOC);
		await doubleClickOn('beta');
		await dragSelection(
			page,
			await textRunCenter(page, 'beta'),
			await textRunStart(page, 'second para')
		);
		await editor.bridge.waitForSourceEquals(CELL_MOVED);
		expect(await converged(page)).toBe(true);
		expect(await cellMatchesRaw(page, 1, 0)).toBe(true);
		expect(await domMatchesRaw(page, 1)).toBe(true);
		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceEquals(CELL_DOC);
	});

	test('a drop inside the selection itself leaves the document alone', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		await dragSelection(page, beta, { x: beta.x + 2, y: beta.y });
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(TWO);
	});

	// ── Drops the editor declines: cancelled outright, never half applied ──

	test('a drop onto a table cell cancels', async ({ page }) => {
		await editor.loadContent(CELL_DOC);
		await doubleClickOn('second');
		await dragSelection(
			page,
			await textRunCenter(page, 'second'),
			await textRunCenter(page, 'zed')
		);
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(CELL_DOC);
		await undoLeavesDocument(editor, CELL_DOC);
	});

	const SOFT_BREAK_DOC = 'first line\nsecond line\n\nsecond para here\n';

	test('a payload carrying a line break cancels the drop', async ({ page }) => {
		await editor.loadContent(SOFT_BREAK_DOC);
		const at = await textRunCenter(page, 'first line');
		await multiClick(page, at, 3);
		await dragSelection(page, at, await textRunStart(page, 'second para'));
		await editor.waitForNoSourceMutation();
		// The payload itself, beside the whole-document read: dropping the line-break guard moves
		// both lines into the target, which this read names and a byte diff only implies.
		expect(await blockRaw(page, 0)).toBe('first line\nsecond line\n');
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(SOFT_BREAK_DOC);
		await undoLeavesDocument(editor, SOFT_BREAK_DOC);
	});

	const LIVE_CODE_DOC = '```js\nconst x = 1\n```\n\nsecond para here\n';

	test('a code block dragged whole in live mode cancels, its hidden fence lines kept', async ({
		page
	}) => {
		await editor.setPresentationMode('live');
		await editor.loadContent(LIVE_CODE_DOC);
		const at = await pointAtRaw(page, [0], 14);
		await multiClick(page, at, 3);
		// The triple-click's range takes both hidden fence lines, the shape the drop must not cut.
		const dragged = await page.evaluate(() => window.getSelection()?.getRangeAt(0).toString());
		expect(dragged).toBe('```js\nconst x = 1\n```');
		await dragSelection(page, at, await textRunStart(page, 'second para'));
		await editor.waitForNoSourceMutation();
		expect(await blockRaw(page, 0)).toBe('```js\nconst x = 1\n```\n');
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(LIVE_CODE_DOC);
		await undoLeavesDocument(editor, LIVE_CODE_DOC);
	});

	test('a range cut out of a bold run in live mode keeps its bold, with no marker on screen', async ({
		page
	}) => {
		await editor.setPresentationMode('live');
		await editor.loadContent('- [ ] Some **bold** and words tail\n');
		const after = await pointAtRaw(page, [0, 0, 0], 'Some **bo'.length);
		await page.mouse.click(after.x, after.y);
		// `ld`, the hidden closer, then ` an`: the arrows step over the closer.
		for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
		expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('ld an');
		const grab = await pointAtRaw(page, [0, 0, 0], 'Some **bol'.length);
		await dragSelection(page, grab, await pastLineEnd(page, 'tail'));
		const text = page.locator("[data-block-path='[0,0,0]'] [contenteditable='true']");
		await expect.poll(() => textOutsideMarkers(text)).toBe('Some bod words tailld an');
		// Both halves keep the bold: the kept `bo` closes, the moved `ld` reopens.
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(
			'- [ ] Some **bo**d words tail**ld** an\n'
		);
		expect(await converged(page)).toBe(true);
	});

	test('a bold range dropped inside another bold run in live mode joins it, no marker on screen', async ({
		page
	}) => {
		await editor.setPresentationMode('live');
		await editor.loadContent('- [ ] Some **bold** and words **tail**\n');
		const after = await pointAtRaw(page, [0, 0, 0], 'Some **bo'.length);
		await page.mouse.click(after.x, after.y);
		for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
		const grab = await pointAtRaw(page, [0, 0, 0], 'Some **bol'.length);
		const into = await pointAtRaw(page, [0, 0, 0], 'Some **bold** and words **ta'.length);
		await dragSelection(page, grab, into);
		// The carried `**ld**` joins the bold it lands in, which closes before ` an` and reopens after.
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.getSource()))
			.toBe('- [ ] Some **bo**d words **tald** an**il**\n');
		const text = page.locator("[data-block-path='[0,0,0]'] [contenteditable='true']");
		expect(await textOutsideMarkers(text)).toBe('Some bod words tald anil');
		expect(await converged(page)).toBe(true);
	});

	const RULE_DOC = 'alpha beta gamma\n\n---\n\nsecond para here\n';

	test('a drop on a block that holds no character position cancels', async ({ page }) => {
		await editor.loadContent(RULE_DOC);
		const beta = await doubleClickOn('beta');
		await dragSelection(page, beta, await blockCenter(page, 1));
		await editor.waitForNoSourceMutation();
		expect(await blockRaw(page, 0)).toBe('alpha beta gamma\n');
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(RULE_DOC);
		await undoLeavesDocument(editor, RULE_DOC);
	});
});
