import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { gotoReady } from '../goto-ready';

// The editor fills the box it's mounted in, through every way a Svelte app can mount it.
// Requirements: e2e/requirements/host-fill.md.

const HOSTS = ['svelte', 'create-editor'] as const;
const HEIGHT = 400;

const host = (page: Page) => page.getByTestId('host');
const root = (page: Page) => host(page).locator('.editor');

function documentBlocks(page: Page): Promise<number> {
	return page.evaluate(() => (window as any).__parityDocuments[0]().children.length);
}

/** The editor root's box height, and whether anything inside it is left to scroll. */
function rootSize(page: Page): Promise<{ height: number; scrolls: boolean }> {
	return root(page).evaluate((el) => ({
		height: el.getBoundingClientRect().height,
		scrolls: el.scrollHeight > el.clientHeight
	}));
}

/** Wheels over the middle of `scroller` and checks it, not the page, scrolled. */
async function wheelScrolls(page: Page, scroller: Locator): Promise<void> {
	const box = (await scroller.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, 2000);
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

async function expectWindowing(page: Page, total: number): Promise<void> {
	await expect.poll(() => root(page).locator('[data-block-path]').count()).toBeLessThan(total);
}

for (const mount of HOSTS) {
	test(`${mount}: a sized host keeps the scroll inside it, with windowing on`, async ({ page }) => {
		await gotoReady(page, `/test/host-fill?host=${mount}&height=${HEIGHT}`);
		const total = await documentBlocks(page);

		const hostHeight = (await host(page).boundingBox())!.height;
		expect((await rootSize(page)).height).toBeLessThanOrEqual(hostHeight + 0.5);
		await wheelScrolls(page, root(page));
		await expectWindowing(page, total);
	});

	test(`${mount}: in host scroll mode a sized host scrolls the whole document`, async ({
		page
	}) => {
		await gotoReady(page, `/test/host-fill?host=${mount}&height=${HEIGHT}&scroll=host`);
		const total = await documentBlocks(page);

		const editor = await rootSize(page);
		expect(editor.scrolls).toBe(false);
		expect(editor.height).toBeGreaterThan(HEIGHT);
		await wheelScrolls(page, host(page));
		await expectWindowing(page, total);
	});

	test(`${mount}: a host with no height grows with the document`, async ({ page }) => {
		await gotoReady(page, `/test/host-fill?host=${mount}`);

		const editor = await rootSize(page);
		expect(editor.scrolls).toBe(false);
		expect((await host(page).boundingBox())!.height).toBeCloseTo(editor.height, 0);
		expect(editor.height).toBeGreaterThan(page.viewportSize()!.height);
	});
}
