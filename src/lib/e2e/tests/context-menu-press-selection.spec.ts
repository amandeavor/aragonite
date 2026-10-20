import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { menuAtClipboardRead, watchClipboardRead } from '../clipboard-arm';
import { textRunCenter } from '../text-runs';
import { PluginsPage } from './plugins/helpers';
import { waitForFirstImageLoaded } from './blocks/image/helpers';

// The right-click menu decides on the selection as it stood when the button went down, since
// Safari selects the word under a right-click before the menu opens; the rows act on the live one.
// Requirements: `requirements/context-menu-press-selection.md`.

const DOC =
	'abcd efgh\n\n---\n\n```\ncode body\n```\n\n| cell | d |\n| --- | --- |\n| e | f |\n\ntail words\n';

interface Point {
	x: number;
	y: number;
}

const dispatchAt = (page: Page, type: 'mousedown' | 'contextmenu', at: Point) =>
	page.evaluate(
		({ type, x, y }) => {
			const init = {
				bubbles: true,
				cancelable: true,
				button: 2,
				buttons: 2,
				clientX: x,
				clientY: y
			};
			document.elementFromPoint(x, y)!.dispatchEvent(new MouseEvent(type, init));
		},
		{ type, ...at }
	);

/** A right-click as Safari delivers it: the press, its own selection under the pointer (which
 *  Playwright's WebKit never makes, so `selectUnder` does), then `contextmenu`. */
async function safariRightClick(page: Page, at: Point, selectUnder: () => Promise<unknown>) {
	await dispatchAt(page, 'mousedown', at);
	await selectUnder();
	await dispatchAt(page, 'contextmenu', at);
}

/** Right-click `word`, which Safari selects; `path` and `start` name it in the editor's offsets. */
async function rightClickWord(editor: EditorPage, word: string, path: number[], start: number) {
	const at = await textRunCenter(editor.page, word);
	await safariRightClick(editor.page, at, async () => {
		const end = start + word.length;
		await editor.bridge.setSelection({
			anchor: { path, offset: start },
			focus: { path, offset: end }
		});
		expect(await editor.page.evaluate(() => window.getSelection()!.toString())).toBe(word);
	});
}

/** Select `tail` in the last block, where the selection toolbar it brings covers nothing above. */
async function selectTail(editor: EditorPage): Promise<void> {
	await editor.focusBlock(4, 0);
	for (let i = 0; i < 4; i++) await editor.page.keyboard.press('Shift+ArrowRight');
	expect(await editor.page.evaluate(() => window.getSelection()!.toString())).toBe('tail');
}

const menuItem = (page: Page, name: string) =>
	page.locator('.md-menu').getByRole('menuitem', { name, exact: true });

test.describe('the right-click menu reads the selection from the press', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=live');
		await editor.loadContent(DOC);
		await editor.focusBlockEnd(0);
	});

	test('a press outside the text selected elsewhere opens the block actions under it', async ({
		page
	}) => {
		await selectTail(editor);
		await rightClickWord(editor, 'body', [2], 9);
		await expect(menuItem(page, 'Copy code block')).toBeVisible();
	});

	test('a real right-click on code outside a selection opens the block actions', async ({
		page
	}) => {
		await selectTail(editor);
		const at = await textRunCenter(page, 'body');
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await expect(menuItem(page, 'Copy code block')).toBeVisible();
	});

	test('a real right-click inside a selection keeps it for the clipboard rows', async ({
		page
	}) => {
		await selectTail(editor);
		const at = await textRunCenter(page, 'tail');
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await expect(menuItem(page, 'Cut')).toBeEnabled();
		await expect(menuItem(page, 'Insert block')).toHaveCount(0);
		expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('tail');
	});
});

// Every engine but Safari leaves a right-click's press as a caret, so the menu a real right-click
// opens there is the one the same press opens after Safari's own select.

/** Every built-in target: prose, a link, an autolink, a rule, code, a cell and an inline image. */
const TARGETS_DOC =
	'abcd efgh\n\n---\n\n```\ncode body\n```\n\n| cell | d |\n| --- | --- |\n| e | f |\n\n' +
	'See [the docs](https://example.com/) here\n\nAt <https://example.org/angle> here\n\n' +
	'Pic ![pic](/test-fixtures/sample.png) here\n';

interface Target {
	name: string;
	open(page: Page): Promise<EditorPage>;
	/** What the user did before the press, from nothing focused. */
	prepare?(page: Page): Promise<void>;
	/** What Safari selects under the press: a word, named in the editor's offsets, or an element
	 *  whole. */
	select: { word: string; path: number[]; start: number } | { element: (page: Page) => Locator };
	/** Whether Safari's word stays for the clipboard rows; anywhere else the caret replaces it. */
	keeps: boolean;
	/** A row the menu must hold, so a menu both presses get wrong still fails. */
	holds: string;
}

const inEditor = async (page: Page) => {
	const editor = new EditorPage(page);
	await editor.goto('?presentationMode=live');
	await editor.loadContent(TARGETS_DOC);
	return editor;
};

const withImage = async (page: Page) => {
	const editor = await inEditor(page);
	await waitForFirstImageLoaded(page);
	return editor;
};

const inPlugins = (seed: string) => async (page: Page) => {
	const editor = new PluginsPage(page);
	await editor.gotoPlugins(seed);
	await editor.setPresentationMode('live');
	await editor.waitForRenderFlush();
	return editor;
};

const widgetIn = (path: string) => (page: Page) =>
	page.locator(`[data-block-path='${path}'] [data-inline-widget]`).first();

const word = (
	name: string,
	select: { word: string; path: number[]; start: number },
	keeps: boolean,
	holds: string
): Target => ({ name, open: inEditor, select, keeps, holds });

const element = (
	name: string,
	open: Target['open'],
	locate: (page: Page) => Locator,
	holds: string
): Target => ({ name, open, select: { element: locate }, keeps: false, holds });

const TARGETS: Target[] = [
	word('a word in prose', { word: 'efgh', path: [0], start: 5 }, true, 'Cut'),
	word('a word in a link', { word: 'docs', path: [4], start: 9 }, true, 'Edit link'),
	word('a word in an autolink', { word: 'angle', path: [5], start: 24 }, true, 'Edit link'),
	word('a word in code', { word: 'body', path: [2], start: 9 }, false, 'Copy code block'),
	word('a word in a cell', { word: 'cell', path: [3, 0, 0], start: 0 }, true, 'Cut'),
	element(
		'a divider',
		inEditor,
		(page) => page.locator("[data-block-path='[1]'] .thematic-break-block"),
		'Copy divider'
	),
	element('an inline image', withImage, widgetIn('[6]'), 'Cut'),
	{
		...element('a selected image', withImage, widgetIn('[6]'), 'Cut'),
		prepare: (page) => widgetIn('[6]')(page).click()
	},
	element(
		'a tag',
		inPlugins('tags'),
		(page) => page.locator('.body-tag[data-tag="project"]'),
		'Edit link'
	),
	element(
		'a wikilink',
		inPlugins('wikilinks'),
		(page) => page.locator('.wikilink[data-target="Meeting notes"]'),
		'Edit link'
	),
	element(
		'a wikilink in a cell',
		inPlugins('wikilinks'),
		(page) => page.locator('.wikilink[data-target="Cell note"]'),
		'Edit link'
	),
	element('an inline equation', inPlugins('math'), widgetIn('[0]'), 'Cut'),
	element('an emoji', inPlugins('emoji'), widgetIn('[0]'), 'Cut'),
	element('a footnote reference', inPlugins('footnotes-ref'), widgetIn('[1]'), 'Cut'),
	element("a plugin's widget", inPlugins('chips'), widgetIn('[0]'), 'Cut'),
	element("a plugin's widget in a cell", inPlugins('chips'), widgetIn('[1]'), 'Cut')
];

interface MenuRead {
	rows: { label: string; enabled: boolean }[];
	selected: string;
}

async function readMenu(page: Page): Promise<MenuRead> {
	const items = page.locator('.md-menu [role=menuitem]');
	await expect(items.first()).toBeVisible();
	const rows = await items.evaluateAll((els) =>
		els.map((el) => ({
			label: el.textContent!.trim(),
			enabled: !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
		}))
	);
	return { rows, selected: await page.evaluate(() => window.getSelection()!.toString()) };
}

/** Opened with nothing focused, as a Safari press on content the caret can't enter leaves it. */
async function openBlurred(page: Page, target: Target): Promise<EditorPage> {
	const editor = await target.open(page);
	await page.evaluate(() => {
		(document.activeElement as HTMLElement | null)?.blur();
		window.getSelection()!.removeAllRanges();
	});
	await target.prepare?.(page);
	return editor;
}

async function elementCenter(locator: Locator): Promise<Point> {
	const box = (await locator.boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Safari's right-click: the word it selects, or the element under the press selected whole. */
async function rightClickAsSafari(editor: EditorPage, target: Target): Promise<void> {
	const { select } = target;
	if ('word' in select) return rightClickWord(editor, select.word, select.path, select.start);
	const locator = select.element(editor.page);
	await safariRightClick(editor.page, await elementCenter(locator), () =>
		locator.evaluate((el) => {
			const range = document.createRange();
			range.selectNode(el.closest('[data-inline-widget]') ?? el);
			window.getSelection()!.removeAllRanges();
			window.getSelection()!.addRange(range);
		})
	);
}

test.describe("a right-click opens the same menu after Safari's own select", () => {
	for (const target of TARGETS) {
		test(target.name, async ({ page }) => {
			const { select } = target;
			await openBlurred(page, target);
			const at =
				'word' in select
					? await textRunCenter(page, select.word)
					: await elementCenter(select.element(page));
			await page.mouse.click(at.x, at.y, { button: 'right' });
			const real = await readMenu(page);

			await rightClickAsSafari(await openBlurred(page, target), target);
			const safari = await readMenu(page);

			expect(safari.rows.map((r) => r.label)).toContain(target.holds);
			expect(safari.rows.map((r) => r.label)).toEqual(real.rows.map((r) => r.label));
			// A cell's menu takes focus, which WebKit lets clear the page's selection, so the word
			// that stays shows as the Copy row it enables.
			if (target.keeps) {
				expect(safari.rows.find((r) => r.label === 'Copy')?.enabled).toBe(true);
			} else {
				expect(safari).toEqual({ rows: real.rows, selected: '' });
			}
		});
	}
});

// Safari shows its native Paste prompt for another app's text; drawn over a menu still on the
// page, it hides the pick the user just made.
test.describe('a menu Paste reads the clipboard once the menu is gone', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=live');
		await editor.loadContent(DOC);
		await editor.seedClipboard('pasted');
		await watchClipboardRead(page);
	});

	const ROUTES: { name: string; open: (page: Page) => Promise<void>; row: string }[] = [
		{ name: 'prose Paste', open: (page) => rightClickOn(page, 'abcd'), row: 'Paste' },
		// The word stays selected after the menu, so the selection toolbar is up at the read.
		{
			name: 'prose Paste over a word Safari selected',
			open: () => rightClickWord(editor, 'abcd', [0], 0),
			row: 'Paste'
		},
		{
			name: 'prose Paste as plain text',
			open: (page) => rightClickOn(page, 'abcd'),
			row: 'Paste as plain text'
		},
		{
			name: 'Replace with clipboard',
			open: (page) => rightClickOn(page, 'code'),
			row: 'Replace with clipboard'
		},
		{ name: 'cell Paste', open: (page) => rightClickOn(page, 'cell'), row: 'Paste' }
	];

	for (const route of ROUTES) {
		test(`${route.name}`, async ({ page }) => {
			await route.open(page);
			await menuItem(page, route.row).click();
			await editor.bridge.waitForSourceContains('pasted');
			expect(await menuAtClipboardRead(page)).toBe(false);
		});
	}
});

async function rightClickOn(page: Page, word: string): Promise<void> {
	const at = await textRunCenter(page, word);
	await page.mouse.click(at.x, at.y, { button: 'right' });
}
