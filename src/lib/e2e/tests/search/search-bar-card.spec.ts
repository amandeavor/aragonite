import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { count, findInput, openFind, typeQuery } from './helpers';

const bar = (page: Page) => page.locator('.search-bar');
const barHeight = (page: Page) => bar(page).evaluate((el) => el.getBoundingClientRect().height);

test.describe('search bar card: layout', () => {
	test('an invalid regex keeps the card at its one-line height', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('alpha beta\n');
		await openFind(editor);
		await page.getByRole('button', { name: 'Regex' }).click();
		await findInput(page).click();
		await typeQuery(editor, 'alpha');
		await expect(count(page)).toHaveText(/1\s+of\s+1/);
		const oneLine = await barHeight(page);

		await findInput(page).fill('(');
		await expect(count(page)).toHaveClass(/error/);
		expect(await barHeight(page)).toBe(oneLine);
		// The message is cut short on the card, so its full text has to stay reachable. Each engine
		// words its regex errors its own way, so the expected wording is the page's own.
		const engineMessage = await page.evaluate((query) => {
			try {
				new RegExp(query, 'gi');
				return '';
			} catch (e) {
				return (e as Error).message;
			}
		}, '(');
		expect(engineMessage).not.toBe('');
		const message = (await count(page).textContent())?.trim() ?? '';
		expect(message).toContain(engineMessage);
		await expect(count(page)).toHaveAttribute('title', message);
	});
});

test.describe('search bar card: focus', () => {
	for (const theme of ['dark', 'light'] as const) {
		test(`the focus ring holds 3:1 against the card and the page (${theme})`, async ({ page }) => {
			const editor = new EditorPage(page);
			await editor.goto(theme === 'light' ? '?theme=light' : '');
			await editor.loadContent('alpha\n');
			await openFind(editor);

			// The page is the first painted background behind the bar.
			const contrasts = () =>
				bar(page).evaluate((el) => {
					const rgb = (c: string) =>
						c
							.match(/[\d.]+/g)!
							.slice(0, 3)
							.map(Number);
					const lum = (c: string) => {
						const [r, g, b] = rgb(c).map((v) => {
							const s = v / 255;
							return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
						});
						return 0.2126 * r + 0.7152 * g + 0.0722 * b;
					};
					const ratio = (a: string, b: string) => {
						const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
						return (hi + 0.05) / (lo + 0.05);
					};
					const painted = (c: string) => c !== 'transparent' && !c.endsWith(', 0)');
					let behind = el.parentElement!;
					while (!painted(getComputedStyle(behind).backgroundColor)) behind = behind.parentElement!;
					const ring = getComputedStyle(el).borderTopColor;
					return {
						card: ratio(ring, getComputedStyle(el).backgroundColor) >= 3,
						page: ratio(ring, getComputedStyle(behind).backgroundColor) >= 3
					};
				});
			await expect.poll(contrasts).toEqual({ card: true, page: true });
		});
	}

	// Clicks that land on the card but on no control: the card is the field, so they type there.
	test('a click on the count or the card’s empty space focuses the find field', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('alpha beta alpha\n');
		await openFind(editor);
		await typeQuery(editor, 'alpha');
		await expect(count(page)).toHaveText(/1\s+of\s+2/);

		const whole = page.getByRole('button', { name: 'Whole word' });
		await whole.focus();
		await count(page).click();
		await expect(findInput(page)).toBeFocused();

		await whole.focus();
		const box = (await bar(page).boundingBox())!;
		// Inside the row's left padding, before the field starts.
		await page.mouse.click(box.x + 5, box.y + box.height / 2);
		await expect(findInput(page)).toBeFocused();
		await expect(findInput(page)).toHaveValue('alpha');
	});
});
