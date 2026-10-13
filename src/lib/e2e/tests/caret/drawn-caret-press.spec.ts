import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { setCaretProp } from '../../carets-showing';

// The drawn caret across a click the editor moves the caret after
// (requirements/caret/drawn-caret-press.md): no frame between the press and the click paints a
// position the click then leaves.

/** Waits `count` frames in the page, so a press is held across real paints. */
function frames(page: Page, count: number): Promise<unknown> {
	return page.evaluate(
		(count) =>
			new Promise<void>((done) => {
				const step = (left: number) =>
					left === 0 ? done() : requestAnimationFrame(() => step(left - 1));
				step(count);
			}),
		count
	);
}

interface BarProbe {
	__barFrames?: (number | null)[];
	__barRun?: boolean;
	__barStop?: boolean;
}

/** The bar's left edge on every frame from the press until two frames after `act`, null on a
 *  frame where it draws nothing. */
async function barLeftFromThePress(
	page: Page,
	act: () => Promise<void>
): Promise<(number | null)[]> {
	await page.evaluate(() => {
		const probe = window as Window & BarProbe;
		probe.__barFrames = [];
		probe.__barRun = false;
		probe.__barStop = false;
		document.addEventListener('pointerdown', () => (probe.__barRun = true), {
			capture: true,
			once: true
		});
		const sample = () => {
			if (probe.__barRun) {
				const bar = document.querySelector<HTMLElement>('.md-drawn-caret');
				probe.__barFrames!.push(bar && !bar.hidden ? bar.getBoundingClientRect().left : null);
			}
			if (!probe.__barStop) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await act();
	await frames(page, 2);
	return page.evaluate(() => {
		const probe = window as Window & BarProbe;
		probe.__barStop = true;
		return probe.__barFrames!;
	});
}

test.describe('the drawn caret across a click that moves the caret', () => {
	for (const mode of ['live', 'source'] as const) {
		test(`a task checkbox click paints no bar before the checkbox, ${mode} mode`, async ({
			page
		}) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await setCaretProp(page, 'drawn');
			await editor.loadContent('para above\n\n- [ ] task one\n');
			await editor.setPresentationMode(mode);
			await editor.focusBlockEnd(0);
			await editor.waitForRenderFlush();
			const box = (await page.locator('.task-checkbox').first().boundingBox())!;

			const seen = await barLeftFromThePress(page, async () => {
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await page.mouse.down();
				await frames(page, 6);
				await page.mouse.up();
			});

			await editor.bridge.waitForSourceContains('- [x] task one');
			const final = seen.at(-1);
			expect(final, 'the bar draws once the click lands').not.toBeNull();
			expect(final!).toBeGreaterThanOrEqual(box.x + box.width);
			const elsewhere = seen.filter((x) => x !== null && Math.abs(x - final!) > 0.5);
			expect(elsewhere, 'frames that painted a spot the click then left').toEqual([]);
		});
	}
});
