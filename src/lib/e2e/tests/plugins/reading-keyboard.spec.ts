import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import { focusWalkKey } from '../../platform-keys';
import { focusWalkReachesLinks } from '../../browser-engine';
import { clickInPlace, hoverInPlace, showInPlace } from '../../click-in-place';
import { textRunCenter } from '../../text-runs';
import { EditorPage } from '../../editor-page';
import { settleScroll } from '../../autoscroll';
import { blockView, capturedErrors, dragBetweenPoints } from './helpers';
import { addHostButtons, focusName } from '../../reading-focus-probes';
import { block, blockStops, controlsFrom, loadKinds, walkOut } from './reading-kinds';

// Reading mode's keyboard is the page's (requirements/plugins/reading-keyboard.md): the editor
// keeps one tab stop, the block last focused, and Tab and Shift+Tab walk only controls.

interface Kind {
	name: string;
	/** Clicks the kind where focus lands on its own focus element. */
	press(page: Page): Promise<void>;
}

const onWord = (path: number[], word: string) => async (page: Page) => {
	await showInPlace(block(page, path));
	const at = await textRunCenter(page, word, { path });
	await page.mouse.click(at.x, at.y);
};
const onBox = (box: (page: Page) => Locator) => (page: Page) => clickInPlace(box(page));

const KINDS: Kind[] = [
	{ name: 'paragraph', press: onWord([2], 'plain') },
	{ name: 'heading', press: onWord([1], 'heading') },
	{ name: 'list item', press: onWord([3, 0, 0], 'one') },
	{ name: 'blockquote line', press: onWord([4, 0], 'quoted') },
	{ name: 'code block', press: onBox((page) => block(page, [5]).locator('.code-block')) },
	{
		name: 'first table cell',
		press: onBox((page) => block(page, [6]).locator('.table-cell').first())
	},
	{
		name: 'last table cell',
		press: onBox((page) => block(page, [6]).locator('.table-cell').last())
	},
	{ name: 'divider', press: onBox((page) => block(page, [7]).locator('.thematic-break-rule')) },
	{ name: 'details summary', press: onWord([8, 0], 'More') },
	{ name: 'admonition title', press: onWord([9, 0], 'Pro') },
	{
		name: 'mermaid diagram',
		press: onBox((page) => block(page, [10]).locator('.mermaid-viewport'))
	},
	{ name: 'footnote definition', press: onWord([13, 0], 'note') }
];

test.describe('reading mode: Tab walks controls, and the editor is one stop', () => {
	for (const kind of KINDS) {
		for (const backward of [false, true]) {
			test(`${kind.name}: clicked, then ${backward ? 'Shift+Tab' : 'Tab'} out`, async ({
				page
			}) => {
				const links = await focusWalkReachesLinks(page);
				await loadKinds(page);
				await addHostButtons(page);

				await kind.press(page);
				const start = await focusName(page);
				expect(await blockStops(page)).toEqual([start.split(' ')[1]]);
				const expected = await controlsFrom(page, backward, links);

				expect(await walkOut(page, backward)).toEqual(expected);
				expect(await capturedErrors(page)).toEqual([]);
			});
		}
	}

	test('before any click, the first block is the stop', async ({ page }) => {
		await loadKinds(page);

		expect(await blockStops(page)).toEqual(['[0]']);
	});

	test('a drag across two blocks still selects, and Tab then leaves the range', async ({
		page
	}) => {
		const links = await focusWalkReachesLinks(page);
		const editor = await loadKinds(page);
		await addHostButtons(page);

		await dragBetweenPoints(
			page,
			await textRunCenter(page, 'plain', { path: [2] }),
			await textRunCenter(page, 'one', { path: [3, 0, 0] })
		);
		const range = await editor.bridge.getSelection();
		expect(range?.anchor.path).toEqual([2]);
		expect(range?.focus.path).toEqual([3, 0, 0]);

		const expected = await controlsFrom(page, false, links);
		expect(await walkOut(page, false)).toEqual(expected);
	});

	test('Enter on a focused footnote reference still jumps to its definition', async ({ page }) => {
		const editor = await loadKinds(page);

		await editor.refs(11).first().focus();
		await page.keyboard.press('Enter');

		await expect.poll(() => blockView(page, [13])).toEqual({ mounted: true, inView: true });
		expect(await focusName(page)).toContain('[13,0]');
	});
});

test.describe('reading mode: the stop follows focus', () => {
	const PLAIN = 'One.\n\nTwo.\n\nThree.\n';

	test('Tab from a host button lands on the block last clicked', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto('?presentationMode=reading');
		await editor.loadContent(PLAIN);
		await addHostButtons(page);

		await clickInPlace(editor.getBlock(1));
		await page.locator('#host-before').focus();
		await page.keyboard.press(focusWalkKey());

		expect(await focusName(page)).toContain('[1]');
	});

	test('in source mode every block keeps its tab stop: Tab from a host button lands on the first', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(PLAIN);
		await addHostButtons(page);

		await clickInPlace(editor.getBlock(1));
		await page.locator('#host-before').focus();
		await page.keyboard.press(focusWalkKey());

		expect(await focusName(page)).toContain('[0]');
	});

	test('scrolled far from the stop, Tab in lands on a block on screen', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto('?presentationMode=reading');
		const paragraphs = Array.from({ length: 200 }, (_, i) => `Paragraph number ${i}.`);
		await editor.loadContent(paragraphs.join('\n\n') + '\n');
		await addHostButtons(page);

		await hoverInPlace(editor.editorContainer);
		await page.mouse.wheel(0, 6000);
		await settleScroll(editor.editorContainer, 'scrollTop');
		await expect.poll(() => blockView(page, [0])).toEqual({ mounted: false, inView: false });
		await page.locator('#host-before').focus();
		await page.keyboard.press(focusWalkKey());

		const path = (await focusName(page)).match(/\[(\d+)\]/)?.[1];
		expect(Number(path)).toBeGreaterThan(20);
		expect(await blockView(page, [Number(path)])).toEqual({ mounted: true, inView: true });
	});

	test('Enter on a focused link still follows it', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto('?presentationMode=reading');
		await editor.loadContent('Go [there](https://example.com/there) now.\n');

		await page.locator('a.md-link-content').focus();
		await page.keyboard.press('Enter');

		await expect
			.poll(() =>
				page.evaluate(
					() => (window as unknown as { __linkActivations?: string[] }).__linkActivations
				)
			)
			.toEqual(['https://example.com/there']);
	});
});
