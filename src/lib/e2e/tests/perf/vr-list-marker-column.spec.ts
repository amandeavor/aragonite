import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { spacerCount } from './vr-helpers';

// A windowed list sizes its marker column from every item, mounted or not.
// Requirements: e2e/requirements/perf/vr-list-marker-column.md.

const ITEMS = 2000;
const longList = (last: string) =>
	Array.from({ length: ITEMS }, (_, i) => `- item ${i}\n`).join('') + `${last}\n`;

test.describe('a windowed list’s marker column', () => {
	// The plain list above is the reference: its text column is what a `- ` asks for.
	for (const { shape, last, wider } of [
		{ shape: 'a to-do', last: '- [ ] last', wider: false },
		{ shape: 'a wider bullet', last: '-   last', wider: true }
	]) {
		test(`an unmounted last item that is ${shape}, source`, async ({ page }) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent(`- x\n\nbreak\n\n${longList(last)}`);
			await editor.waitForRenderFlush();

			expect(await spacerCount(page, '.list-block >')).toBeGreaterThan(0);
			const columns = await page.evaluate(() => {
				const [control, long] = [...document.querySelectorAll('.editor .list-block')].map(
					(list) =>
						list
							.querySelector(':scope > .list-item-block > .list-item-content')!
							.getBoundingClientRect().left
				);
				return { control, long, items: document.querySelectorAll('.list-item-block').length };
			});
			// The last item is unmounted, so only the counts the list keeps could widen the column.
			expect(columns.items).toBeLessThan(ITEMS / 2);
			if (wider) expect(columns.long).toBeGreaterThan(columns.control + 0.5);
			else expect(Math.abs(columns.long - columns.control)).toBeLessThanOrEqual(0.5);
		});
	}
});
