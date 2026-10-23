// Fails a test on any console error, page error, aragonite dev warning or Vue warning the page
// produced; with `anyWarning`, on every console warning.
import { test as base, expect, type Page } from '@playwright/test';

const WARNINGS = /\[aragonite:|\[Vue warn\]/;

export const test = base.extend<{ problems: string[]; anyWarning: boolean }>({
	anyWarning: [false, { option: true }],
	problems: [
		async ({ page, anyWarning }, use) => {
			const problems: string[] = [];
			page.on('pageerror', (error) => problems.push(String(error)));
			page.on('console', (message) => {
				const warned =
					message.type() === 'warning' && (anyWarning || WARNINGS.test(message.text()));
				if (message.type() === 'error' || warned) problems.push(message.text());
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
/** The paragraphs in the document every app's `load-long` button loads. */
export const LONG_BLOCKS = 300;

/** The editable holding `text`, with the caret placed at its end by a click and End. */
export async function caretAtEnd(page: Page, text: string): Promise<void> {
	const block = page.locator('.editor [contenteditable="true"]', { hasText: text });
	await block.click();
	await page.keyboard.press('End');
}

export const mirror = (page: Page) => page.getByTestId('mirror');

/** Every listener on `window` and `document`, as `target:type`, sorted. Chromium only. */
export async function pageListeners(page: Page): Promise<string[]> {
	const cdp = await page.context().newCDPSession(page);
	const found: string[] = [];
	for (const target of ['window', 'document']) {
		const { result } = await cdp.send('Runtime.evaluate', { expression: target });
		const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
			objectId: result.objectId!
		});
		found.push(...listeners.map((listener) => `${target}:${listener.type}`));
	}
	await cdp.detach();
	return found.sort();
}
