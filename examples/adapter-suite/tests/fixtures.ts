// Fails a test on any console error, page error or aragonite dev warning the page produced.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ problems: string[] }>({
	problems: [
		async ({ page }, use) => {
			const problems: string[] = [];
			page.on('pageerror', (error) => problems.push(String(error)));
			page.on('console', (message) => {
				const ours = message.type() === 'warning' && message.text().includes('[aragonite:');
				if (message.type() === 'error' || ours) problems.push(message.text());
			});
			await use(problems);
			expect(problems, `console or page errors:\n${problems.join('\n')}`).toEqual([]);
		},
		{ auto: true }
	]
});

export { expect };

export const FIRST = '# First note\n\nHello from the first note.\n';
export const SECOND = '# Second note\n\nA different document.\n';

/** The editable holding `text`, with the caret placed at its end by a click and End. */
export async function caretAtEnd(page: Page, text: string): Promise<void> {
	const block = page.locator('.editor [contenteditable="true"]', { hasText: text });
	await block.click();
	await page.keyboard.press('End');
}

export const mirror = (page: Page) => page.getByTestId('mirror');
