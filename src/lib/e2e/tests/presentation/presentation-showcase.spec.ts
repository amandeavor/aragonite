import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { gotoReady } from '../../goto-ready';
import { clickModeButton } from '../../mode-switch';

// The `/` showcase's presentation-mode toggle. This route has no `window.__test` bridge, so the
// assertions read the rendered DOM only, like showcase-route.spec.ts, and nothing here names a
// sentence of the demo document, which the owner rewrites by hand.
// Requirements: e2e/requirements/presentation/presentation-showcase.md.

// The markers reading mode hides outright. A list's leading marker keeps its box, with a bullet
// painted in it, so it carries `[contenteditable='false']` and is not one of these.
const MARKER = ".md-marker:not([contenteditable='false'])";

/** Scroll to the end of the document, the one position a mode change cannot move. */
async function scrollToEnd(page: Page): Promise<void> {
	const editor = page.locator('.editor');
	for (let step = 0; step < 200; step++) {
		const settled = await editor.evaluate((el) => {
			const before = el.scrollTop;
			el.scrollTop = el.scrollHeight;
			return el.scrollTop <= before;
		});
		await page.waitForTimeout(60);
		if (settled) return;
	}
}

test.describe('/ showcase presentation toggle', () => {
	test.beforeEach(async ({ page }) => {
		await gotoReady(page, '/');
	});

	test('reading hides markers, keeps rendered widgets; source restores', async ({ page }) => {
		// Live is the showcase's default and paints no marker: the round trip starts from source.
		await clickModeButton(page, 'source');
		// The tour's inline widgets sit well below the fold, and asserting "the widgets survived"
		// where none are mounted is the empty pass this scenario exists to avoid.
		await scrollToEnd(page);
		const widgets = page.locator('[data-inline-widget]');
		await expect
			.poll(() => widgets.count(), {
				message: 'the demo document mounts no inline widget'
			})
			.toBeGreaterThan(0);
		await expect(page.locator(`${MARKER}:visible`).first()).toBeVisible();
		const before = await settledBlockText(page);

		await clickModeButton(page, 'reading');
		await expect(page.locator(`${MARKER}:visible`)).toHaveCount(0);
		await expect.poll(() => widgets.count()).toBeGreaterThan(0);

		await clickModeButton(page, 'source');
		await expect(page.locator(`${MARKER}:visible`).first()).toBeVisible();
		// Hiding markers shortens the document, so the window after the round trip need not be
		// the window before it: compare block by block over the blocks mounted both times.
		await scrollToEnd(page);
		await expect
			.poll(async () => {
				const after = await mountedBlockText(page);
				const shared = Object.keys(before).filter((path) => path in after);
				// Both texts, not just the path: which block moved is a separate question from whether it
				// rendered differently or was read mid-frame.
				const drifted = shared
					.filter((path) => after[path] !== before[path])
					.map((path) => `${path} ${trim(before[path])} -> ${trim(after[path])}`);
				return { shared: shared.length, drifted };
			})
			.toEqual({ shared: expect.any(Number), drifted: [] });
		const after = await mountedBlockText(page);
		expect(Object.keys(before).filter((path) => path in after).length).toBeGreaterThan(4);
	});
});

/** The placeholder a renderer mounts while it is still working. A sample taken over one of these
 *  is a sample of a half-rendered document, which the mode change would then be blamed for. */
const PENDING_RENDER = '.mermaid-loading';

/** The mounted text once nothing is still rendering and two reads agree, each read taking the
 *  text and the placeholders together, so no diagram's placeholder text passes as settled. */
async function settledBlockText(page: Page): Promise<Record<string, string>> {
	let previous = '';
	let settled: Record<string, string> = {};
	await expect
		.poll(
			async () => {
				const sample = await sampleBlocks(page);
				const key = JSON.stringify(sample.text);
				const steady = sample.pending === 0 && key === previous;
				previous = key;
				settled = sample.text;
				return steady;
			},
			{
				message: 'the showcase document never settled: a block is still rendering',
				timeout: 20_000
			}
		)
		.toBe(true);
	return settled;
}

/** One block's text, short enough to read in a failure message. */
const trim = (text: string) =>
	JSON.stringify(text.length > 80 ? `${text.slice(0, 40)}…${text.slice(-40)}` : text);

/** Text per mounted block, keyed by path: a windowed editor's text is only its mounted part. */
async function mountedBlockText(page: Page): Promise<Record<string, string>> {
	return (await sampleBlocks(page)).text;
}

/** The mounted text and the count of renderers still working, read in one go. */
function sampleBlocks(page: Page): Promise<{ text: Record<string, string>; pending: number }> {
	return page.evaluate((pendingSelector) => {
		const hosts = Array.from(document.querySelectorAll('.block-host[data-block-path]'));
		return {
			text: Object.fromEntries(
				hosts.map((host) => [host.getAttribute('data-block-path') ?? '', host.textContent ?? ''])
			),
			pending: document.querySelectorAll(pendingSelector).length
		};
	}, PENDING_RENDER);
}
