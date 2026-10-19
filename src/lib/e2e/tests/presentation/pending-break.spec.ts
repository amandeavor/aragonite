import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import type { EditorPage } from '../../editor-page';
import { attachIme } from '../../simulation/ime';
import { clickBlockSettled, clickWordSettled, enterPresentationMode, focusPath } from './helpers';
import { edgeKey, extendKey } from '../../platform-keys';

// Shift+Enter at a block's end opens a line and writes nothing; whatever is inserted next writes
// the break in front of itself, and anything else drops the line without leaving a byte.
// Requirements: e2e/requirements/presentation/pending-break.md.

const MODES = ['source', 'live'] as const;

/** The block's end, then Shift+Enter `times` over. */
async function openBreak(ep: EditorPage, page: Page, times = 1): Promise<void> {
	await clickBlockSettled(ep, 0);
	await page.keyboard.press(edgeKey('lineEnd'));
	for (let i = 0; i < times; i++) await page.keyboard.press('Shift+Enter');
	await ep.waitForRenderFlush();
}

const breakAnchors = (page: Page) =>
	page.locator('.block-host').first().locator('br[data-caret-anchor="break"]');

/** Whether the run being composed sits after the open line's first anchor, on the new line. The
 *  browser may swap the line's last anchor for the run, so only the first is looked for. */
const composedAfterBreak = (page: Page, run: string) =>
	page
		.locator('.block-host')
		.first()
		.locator('[contenteditable]')
		.evaluate((el, composed) => {
			const anchor = el.querySelector('br[data-caret-anchor="break"]');
			for (let node = anchor?.nextSibling; node; node = node.nextSibling) {
				if (node.textContent?.includes(composed)) return true;
			}
			return false;
		}, run);

for (const mode of MODES) {
	test.describe(`${mode} mode: a backslash typed at a block's end`, () => {
		test('stays a backslash, and the next key types after it', async ({ page }) => {
			const ep = await enterPresentationMode(page, mode, 'see C:\n');
			await clickBlockSettled(ep, 0);
			await page.keyboard.press(edgeKey('lineEnd'));
			await ep.typeSlowly('\\U');
			await expect.poll(() => ep.bridge.getSource()).toBe('see C:\\U\n');
		});
	});

	test.describe(`${mode} mode: the insertion after Shift+Enter at the end`, () => {
		test('two Shift+Enters open two lines, and the caret stays on the second', async ({ page }) => {
			const ep = await enterPresentationMode(page, mode, 'abc def\n');
			await openBreak(ep, page, 2);
			expect(await ep.bridge.getSource()).toBe('abc def\n');

			await ep.typeSlowly('x');

			await expect.poll(() => ep.bridge.getSource()).toBe('abc def\\\n\\\nx\n');
		});
	});

	test.describe(`${mode} mode: a Shift+Enter nothing is typed after`, () => {
		test('leaves no byte and no line once the caret moves to another block', async ({ page }) => {
			const ep = await enterPresentationMode(page, mode, 'abc\n\nnext\n');
			await openBreak(ep, page);
			await expect(breakAnchors(page)).toHaveCount(2);

			await clickBlockSettled(ep, 1);

			await expect(breakAnchors(page)).toHaveCount(0);
			expect(await ep.bridge.getSource()).toBe('abc\n\nnext\n');
		});
	});
}

test.describe('live mode: a composed run after a hidden closer', () => {
	for (const [source, written] of [
		['a **bold**\n', 'a **bold**\\\nか\n'],
		['an *it*\n', 'an *it*\\\nか\n'],
		['via `code`\n', 'via `code`\\\nか\n']
	]) {
		test(`starts the new line after ${JSON.stringify(source)}, drawn while composing`, async ({
			page
		}) => {
			const ep = await enterPresentationMode(page, 'live', source);
			await openBreak(ep, page);
			const ime = await attachIme(page);

			await ime.compose('か');
			await expect.poll(() => composedAfterBreak(page, 'か')).toBe(true);
			await ime.commit('か');

			await expect.poll(() => ep.bridge.getSource()).toBe(written);
		});
	}
});

/** `doc`'s first block, `def`'s line ended by Shift+Enter, `x` and a Backspace: the line under the
 *  text is open again, with the caret on it, and the break's bytes went with the `x`. */
async function emptiedBreak(ep: EditorPage, page: Page): Promise<void> {
	await clickWordSettled(ep, page, 'def');
	await page.keyboard.press(edgeKey('lineEnd'));
	await page.keyboard.press('Shift+Enter');
	await ep.typeSlowly('x');
	await page.keyboard.press('Backspace');
	await ep.waitForRenderFlush();
}

const EMPTIED = [
	['a paragraph', 'abc def\n', 'abc def\\\ny\n'],
	['a list item followed by another', '- abc def\n- next\n', '- abc def\\\n  y\n- next\n'],
	['a quote', '> abc def\n', '> abc def\\\n> y\n'],
	['the last block, with no line ending after it', 'next\n\nabc def', 'next\n\nabc def\\\ny']
] as const;

test.describe('live mode: a hard break at a block end, emptied again', () => {
	for (const [name, doc, typed] of EMPTIED) {
		test(`in ${name}, the line stays open and the next letter writes the break`, async ({
			page
		}) => {
			const ep = await enterPresentationMode(page, 'live', doc);
			await emptiedBreak(ep, page);
			expect(await ep.bridge.getSource()).toBe(doc);

			await ep.typeSlowly('y');

			await expect.poll(() => ep.bridge.getSource()).toBe(typed);
		});

		test(`in ${name}, Backspace takes the line`, async ({ page }) => {
			const ep = await enterPresentationMode(page, 'live', doc);
			await emptiedBreak(ep, page);

			await page.keyboard.press('Backspace');
			await ep.waitForRenderFlush();
			await ep.typeSlowly('y');

			await expect.poll(() => ep.bridge.getSource()).toBe(doc.replace('def', 'defy'));
		});
	}

	test('in a list item followed by another, the line is gone after a blur', async ({ page }) => {
		const ep = await enterPresentationMode(page, 'live', '- abc def\n- next\n');
		await emptiedBreak(ep, page);

		await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		await ep.waitForRenderFlush();

		expect(await ep.bridge.getSource()).toBe('- abc def\n- next\n');
	});
});

for (const mode of MODES) {
	test.describe(`${mode} mode: the emptied line after a hard break at a block end`, () => {
		test('ArrowUp leaves it for good, so ArrowDown goes on to the next item', async ({ page }) => {
			const ep = await enterPresentationMode(page, mode, '- abc def\n- next\n');
			await emptiedBreak(ep, page);
			await page.keyboard.press('ArrowUp');
			await ep.waitForRenderFlush();
			expect(await focusPath(ep)).toEqual([0, 0, 0]);

			await page.keyboard.press('ArrowDown');
			await ep.waitForRenderFlush();

			expect(await focusPath(ep)).toEqual([0, 1, 0]);
			expect(await ep.bridge.getSource()).toBe('- abc def\n- next\n');
		});
	});
}

for (const mode of MODES) {
	test.describe(`${mode} mode: the line after a hard break, emptied by a cut`, () => {
		test('stays open, and the next letter writes the break again', async ({ page }) => {
			const ep = await enterPresentationMode(page, mode, 'abc\\\nxy\n\nnext\n');
			await clickWordSettled(ep, page, 'xy');
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press(extendKey('lineStart'));
			await page.keyboard.press('ControlOrMeta+x');
			await expect.poll(() => ep.bridge.getSource()).toBe('abc\n\nnext\n');

			await ep.typeSlowly('q');

			await expect.poll(() => ep.bridge.getSource()).toBe('abc\\\nq\n\nnext\n');
		});
	});
}
