import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { gotoReady } from '../goto-ready';

// The dev warning for an app that forgot `editor-theme.css` (G1.99). Unit mounts have no layout,
// so only a real browser can show it fires where it should and nowhere else.
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
