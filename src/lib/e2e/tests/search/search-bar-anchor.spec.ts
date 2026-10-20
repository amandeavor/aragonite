import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { gotoReady } from '../../goto-ready';
import { findInput, openFind, overlays, replaceInput, typeQuery } from './helpers';
import { edgeKey } from '../../platform-keys';

const anchor = (page: Page) => page.getByTestId('search-anchor');
const anchoredBar = (page: Page) => anchor(page).locator('.search-bar');
const rootBar = (page: Page) => page.locator('.editor .search-bar');

// The theme scope's `--color-bg` per mode; the page's own `:root` value stays dark, so a bar that
// left the scope behind would hold dark through the flip.
const TOKEN_DARK = 'rgb(44, 44, 42)';
const TOKEN_LIGHT = 'rgb(223, 221, 215)';

const barBackground = (page: Page) =>
	anchoredBar(page).evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe('search bar: consumer anchor', () => {
	let editor: EditorPage;
	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?searchAnchor=on');
		await editor.loadContent('alpha beta\n\ngamma alpha\n');
	});

	test('Ctrl+F renders the bar inside the anchor, not the editor root', async ({ page }) => {
		await openFind(editor);
		await expect(anchoredBar(page)).toBeVisible();
		await expect(rootBar(page)).toHaveCount(0);
		await expect(findInput(page)).toBeFocused();
	});

	test('typing in the anchored bar paints the document highlights', async ({ page }) => {
		await openFind(editor);
		await typeQuery(editor, 'alpha');
		await expect(overlays(page)).toHaveCount(2);
	});

	test('Ctrl+H opens the anchored bar with the replace row expanded', async ({ page }) => {
		await editor.clickBlock(0);
		await page.keyboard.press('ControlOrMeta+h');
		await expect(replaceInput(page)).toBeVisible();
		await expect(anchoredBar(page)).toBeVisible();
	});

	test('theme tokens resolve inside the anchor and follow a live theme flip', async ({ page }) => {
		await openFind(editor);
		// The bar's anchor element sits outside every `.aragonite-editor-theme` ancestor, so this value
		// can only come from the scope the portaled node brought with it.
		expect(await barBackground(page)).toBe(TOKEN_DARK);

		await page.getByTestId('theme-toggle').click();
		await expect.poll(() => barBackground(page)).toBe(TOKEN_LIGHT);
	});

	test('dropping the anchor returns the open bar home, query intact', async ({ page }) => {
		await openFind(editor);
		await typeQuery(editor, 'alpha');
		await expect(overlays(page)).toHaveCount(2);

		await page.getByTestId('anchor-toggle').click();
		await expect(rootBar(page)).toBeVisible();
		await expect(anchoredBar(page)).toHaveCount(0);
		await expect(findInput(page)).toHaveValue('alpha');
		await expect(overlays(page)).toHaveCount(2);

		await page.getByTestId('anchor-toggle').click();
		await expect(anchoredBar(page)).toBeVisible();
		await expect(rootBar(page)).toHaveCount(0);
	});

	test('Esc closes the anchored bar and the next keystroke lands at the pre-search caret', async ({
		page
	}) => {
		await editor.clickBlock(0);
		await page.keyboard.press(edgeKey('lineEnd'));
		await page.keyboard.press('ControlOrMeta+f');
		await expect(findInput(page)).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(findInput(page)).toHaveCount(0);
		await page.keyboard.type('!');
		await editor.bridge.waitForSourceContains('alpha beta!');
	});
});

test.describe('search bar: anchored in a host with no theme class', () => {
	// `/test/host-theme` has no `.aragonite-editor-theme` anywhere, so the moved bar sits under
	// nothing that declares the editor's own tokens unless it brings them itself.
	test('the moved bar brings the editor-owned tokens, in the current mode', async ({ page }) => {
		await gotoReady(page, '/test/host-theme?searchAnchor=on');
		await page.getByRole('combobox', { name: 'Theme' }).selectOption('warm-light');
		await page.locator('.editor [contenteditable="true"]').first().click();
		await page.keyboard.press('ControlOrMeta+f');
		await expect(anchoredBar(page)).toBeVisible();

		const chipFill = () =>
			anchoredBar(page).evaluate((el) =>
				getComputedStyle(el).getPropertyValue('--menu-chip-bg').trim()
			);
		// The light declaration; an empty read drops the bar to its dark inline fallback.
		expect(await chipFill()).toBe('rgba(0, 0, 0, 0.045)');

		await page.getByRole('combobox', { name: 'Theme' }).selectOption('warm-dark');
		await expect.poll(chipFill).toBe('rgba(255, 255, 255, 0.055)');
	});
});

test.describe('search bar: no anchor supplied', () => {
	test('the bar renders in the editor root, as it always has', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('alpha beta\n');
		await openFind(editor);
		await expect(page.locator('.editor > .search-anchor .search-bar')).toBeVisible();
	});
});
