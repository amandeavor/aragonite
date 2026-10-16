import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { gotoReady } from '../goto-ready';

// An app that forgot `editor-theme.css` (the G1.99 dev warning) or replaced it with its own sheet.
// Unit mounts load no stylesheet, so only a real browser shows either.
// Requirements: e2e/requirements/theme-stylesheet.md.

/** Drops the theme stylesheet the dev server injected and, unless kept, the page's own colors. */
async function dropThemeStylesheet(page: Page, keepPageColors: boolean): Promise<void> {
	const removed = await page.evaluate((keep) => {
		const sheet = document.querySelector('style[data-vite-dev-id$="editor-theme.css"]');
		sheet?.remove();
		// The site's `:root` and the harness wrapper each declare one.
		if (!keep) {
			for (const el of [document.documentElement, document.querySelector('.test-harness')]) {
				(el as HTMLElement).style.setProperty('--color-bg', 'initial');
			}
		}
		return sheet !== null;
	}, keepPageColors);
	expect(removed, 'the dev server injected the theme stylesheet as a style element').toBe(true);
}

/** The harness remounts its editor when the drag-handle toggle flips. */
async function remount(page: Page): Promise<void> {
	await page.getByLabel('Drag handles').click();
	await expect(page.locator('.editor .block-host').first()).toBeVisible();
}

// A wholesale replacement for `editor-theme.css`: color values on `.editor`, none of the rules
// that hand them to the editor's own surfaces.
const REPLACEMENT_SHEET = `.editor {
	--color-bg: rgb(10, 20, 30);
	--color-surface: rgb(11, 21, 31);
	--color-text-primary: rgb(200, 210, 220);
	--color-text-secondary: rgb(190, 200, 210);
	--color-border: rgb(60, 70, 80);
	--color-ui-muted: rgb(120, 130, 140);
	--color-ui-dulled: rgb(130, 140, 150);
	--color-accent: rgb(40, 160, 90);
	--color-error: rgb(230, 60, 50);
}`;

const computed = (page: Page, selector: string, property: string) =>
	page
		.locator(selector)
		.first()
		.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

test.describe('theme stylesheet warning', () => {
	test.beforeEach(async ({ page }) => {
		await gotoReady(page, '/test/editor');
	});

	test('a mount with the theme stylesheet loaded logs nothing', async ({ page }) => {
		await remount(page);
	});

	test('a page that declares its own colors needs no theme stylesheet', async ({ page }) => {
		await dropThemeStylesheet(page, true);
		await remount(page);
	});

	test.describe('with neither the stylesheet nor page colors', () => {
		test.use({ expectInvariants: ['host-colors-resolve'] });

		test('a mount warns and names the import', async ({ page }) => {
			const message = page.waitForEvent('console', (m) => m.text().includes('host-colors-resolve'));
			await dropThemeStylesheet(page, false);
			await remount(page);
			expect((await message).text()).toContain('@voithos-labs/aragonite/styles/editor-theme.css');
		});
	});
});

test.describe('a theme stylesheet replaced wholesale', () => {
	test('the editor text, its scrollbar and the find bar take the replacement colors', async ({
		page
	}) => {
		await gotoReady(page, '/test/editor');
		await dropThemeStylesheet(page, false);
		await page.addStyleTag({ content: REPLACEMENT_SHEET });
		await remount(page);
		expect(await computed(page, '.editor', 'color')).toBe('rgb(200, 210, 220)');
		expect(await computed(page, '.editor', 'scrollbar-color')).toBe(
			'rgb(60, 70, 80) rgba(0, 0, 0, 0)'
		);
		await page.locator('.editor [contenteditable="true"]').first().click();
		await page.keyboard.press('ControlOrMeta+f');
		await expect(page.getByRole('textbox', { name: 'Find' })).toBeVisible();
		expect(await computed(page, '.search-bar', 'background-color')).toBe('rgb(10, 20, 30)');
	});
});
