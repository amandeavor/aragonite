import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { textRunCenter } from '../text-runs';
import { openImageField } from './blocks/image/helpers';
import { PluginsPage } from './plugins/helpers';

// Every editor popover closes on a press outside it and on Escape, with focus wherever the press
// left it: Safari focuses no clicked button, so nothing may wait on the opener's focus.
// Requirements: `requirements/popover-close.md`.

const DOC = [
	'plain words here',
	'![cat](/test-fixtures/sample.png)',
	'```js\nconst x = 1\n```',
	'| A | B |\n| --- | --- |\n| 1 | 2 |',
	'see [link](https://example.com) here',
	'Type here',
	// Far from the js block, so that block's open popouts never cover its buttons.
	'```py\ny = 2\n```',
	'![dog](/test-fixtures/sample.png)'
].join('\n\n');

const block = (page: Page, index: number): Locator =>
	page.locator(`[data-block-path='${JSON.stringify([index])}']`);

interface Popover {
	name: string;
	open(page: Page, editor: EditorPage): Promise<void>;
	/** What must be gone once it closes. */
	shown(page: Page): Locator;
}

const blockMenu = (page: Page) => page.getByRole('menu', { name: 'Block actions' });

const POPOVERS: Popover[] = [
	{
		name: 'block menu',
		open: async (page) => {
			const at = await textRunCenter(page, 'const');
			await page.mouse.click(at.x, at.y, { button: 'right' });
			await expect(
				blockMenu(page)
					.getByRole('menuitem', { name: /code block/ })
					.first()
			).toBeVisible();
		},
		shown: blockMenu
	},
	{
		name: 'block menu flyout',
		open: async (page) => {
			const at = await textRunCenter(page, 'Type');
			await page.mouse.click(at.x, at.y, { button: 'right' });
			await page.getByRole('menuitem', { name: 'Insert block' }).hover();
			await expect(page.locator('.block-menu-flyout')).toBeVisible();
		},
		shown: (page) => page.locator('.block-menu-flyout')
	},
	{
		name: 'code overflow menu',
		open: async (page) => {
			await block(page, 2).hover();
			await block(page, 2).getByRole('button', { name: 'Code block actions' }).click();
			await expect(page.locator('.code-rail-menu')).toBeVisible();
		},
		shown: (page) => page.locator('.code-rail-menu')
	},
	{
		name: 'language picker',
		open: async (page) => {
			await block(page, 2).hover();
			await block(page, 2).locator('.code-lang-button').click();
			await expect(page.locator('.code-lang-picker')).toBeVisible();
		},
		shown: (page) => page.locator('.code-lang-picker')
	},
	{
		name: 'table menu',
		open: async (page) => {
			await page.locator('.table-cell').nth(2).click({ button: 'right' });
			await expect(page.getByRole('menu', { name: 'Table actions' })).toBeVisible();
		},
		shown: (page) => page.getByRole('menu', { name: 'Table actions' })
	},
	{
		name: 'link card',
		open: async (page) => {
			const at = await textRunCenter(page, 'link');
			await page.mouse.click(at.x, at.y);
			await expect(page.locator('[data-link-card]')).toBeVisible();
		},
		shown: (page) => page.locator('[data-link-card]')
	},
	{
		name: 'image alt field',
		open: async (page) => {
			await block(page, 1).locator('[data-image-widget]').click();
			await openImageField(page);
		},
		shown: (page) => page.locator('.md-image-field')
	},
	{
		name: 'inline menu',
		open: async (page, editor) => {
			await editor.focusBlockEnd(5);
			await page.keyboard.type(' /');
			await expect(page.locator('[data-inline-menu]')).toBeVisible();
		},
		shown: (page) => page.locator('[data-inline-menu]')
	}
];

/** Where the press lands: never on the popover's own block, and never a focusable control's
 *  ancestor that would take focus for the button in WebKit. */
const OUTSIDE: { name: string; press(page: Page): Promise<void> }[] = [
	{
		name: 'plain text',
		press: async (page) => {
			const at = await textRunCenter(page, 'plain');
			await page.mouse.click(at.x, at.y);
		}
	},
	{
		name: 'an image',
		press: async (page) => {
			await block(page, 7).locator('[data-image-widget]').click();
		}
	},
	{
		name: "another block's chrome",
		press: async (page) => {
			await block(page, 6).hover();
			await block(page, 6).getByRole('button', { name: 'Copy code' }).click();
		}
	}
];

test.describe('every popover closes without its opener holding focus', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?codeActions=on&presentationMode=live&slash=on');
		await editor.loadContent(DOC + '\n');
	});

	for (const popover of POPOVERS) {
		for (const outside of OUTSIDE) {
			test(`${popover.name}: a press on ${outside.name} closes it`, async ({ page }) => {
				await popover.open(page, editor);
				await outside.press(page);
				await expect(popover.shown(page)).toHaveCount(0);
			});
		}

		test(`${popover.name}: Escape closes it`, async ({ page }) => {
			await popover.open(page, editor);
			await page.keyboard.press('Escape');
			await expect(popover.shown(page)).toHaveCount(0);
		});
	}

	test('Shift+Tab out of the gutter closes the overflow menu', async ({ page }) => {
		await block(page, 2).hover();
		await block(page, 2).getByRole('button', { name: 'Code block actions' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('.code-rail-menu')).toBeVisible();
		const inGutter = () =>
			page.evaluate(() => !!document.activeElement?.closest('.code-rail, .code-rail-menu'));
		for (let i = 0; i < 6 && (await inGutter()); i++) await page.keyboard.press('Shift+Tab');
		expect(await inGutter()).toBe(false);
		await expect(page.locator('.code-rail-menu')).toHaveCount(0);
	});

	test('Escape closes a flyout before the menu it hangs off', async ({ page }) => {
		await POPOVERS[1].open(page, editor);
		await page.keyboard.press('Escape');
		await expect(page.locator('.block-menu-flyout')).toHaveCount(0);
		await expect(blockMenu(page)).toBeVisible();
	});
});

// Miss-analysis: the toolbar's flyout was left out as hover chrome, and every toolbar row opened it
// by hover alone, so no row clicked the button the hover had just opened it under.
test("the toolbar's heading flyout stays open under a click, and Escape closes it alone", async ({
	page
}) => {
	const editor = new EditorPage(page);
	await editor.goto('?presentationMode=live');
	await editor.loadContent('select some words\n\nother text\n');
	await editor.focusBlock(0, 0);
	for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight');
	const setHeading = page.locator('[data-testid="toolbar-set-heading"]');
	const flyout = page.locator('.selection-toolbar-flyout');
	await setHeading.hover();
	await expect(flyout).toBeVisible();
	await setHeading.click();
	await expect(flyout).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(flyout).toHaveCount(0);
	await expect(page.locator('[data-testid="selection-toolbar"]')).toBeVisible();
	expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('select');
});

test.describe('the link card beside a live caret', () => {
	test('one Escape closes the card and the source shown under the caret', async ({ page }) => {
		const editor = new PluginsPage(page);
		await editor.gotoPlugins('mathtable');
		await editor.setPresentationMode('live');
		await editor.loadContent('see [a $x^2$ b](https://example.com) here\n');
		const math = page.locator('.math-inline-widget');
		const b = await textRunCenter(page, 'b');
		await page.mouse.click(b.x - 3, b.y);
		await expect(page.locator('[data-link-card]')).toBeVisible();
		// Back over the space and into the formula, which shows its source under the caret.
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(math).toHaveCount(0);
		await expect(page.locator('[data-link-card]')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-link-card]')).toHaveCount(0);
		await expect(math).toHaveCount(1);
	});
});
