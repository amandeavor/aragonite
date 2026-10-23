import { test, expect, LONG_BLOCKS } from './fixtures';

// The framework component fills the height its `style` gives it. Requirements: host-fill.md.

test('a sized host keeps the scroll inside it, with windowing on', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('load-long').click();
	const root = page.locator('.editor');
	await expect(root).toContainText('Paragraph 1.');

	const box = (await root.boundingBox())!;
	const hostHeight = (await root.locator('..').boundingBox())!.height;
	expect(box.height).toBeLessThanOrEqual(hostHeight + 0.5);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, 2000);
	await expect.poll(() => root.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
	await expect.poll(() => root.locator('[data-block-path]').count()).toBeLessThan(LONG_BLOCKS);
});
