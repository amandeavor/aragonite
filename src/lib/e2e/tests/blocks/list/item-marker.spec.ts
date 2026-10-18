import type { Page } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';
import { attachIme } from '../../../simulation/ime';
import type { PresentationMode } from '../../../../presentation-mode';

// Requirements: `e2e/requirements/blocks/list/item-marker.md`.

interface Band {
	top: number;
	bottom: number;
}

interface MarkerRead {
	/** The marker's painted box: the drawn checkbox, else its glyphs. */
	marker: Band;
	/** Visible and undimmed enough to read: computed visibility, and the opacity it paints at. */
	visibility: string;
	opacity: number;
	/** The marker's bytes, as the DOM holds them. */
	text: string;
	/** The first painted glyph of the item's own content; null for an empty item. */
	firstText: Band | null;
	/** The first line of the item's first text block, for an item with no glyph to measure. */
	firstLine: Band | null;
}

/** Reads the first item's own marker, found by its nearest item, so a nested item's marker never
 *  answers for its parent. */
function readMarker(page: Page, nth = 0): Promise<MarkerRead> {
	return page.evaluate((n) => {
		const item = document.querySelectorAll('.editor .list-item-block')[n];
		const own = [...item.querySelectorAll<HTMLElement>('.md-marker[contenteditable="false"]')].find(
			(m) => m.closest('.list-item-block') === item
		);
		if (!own) throw new Error('the item paints no marker');
		const band = (r: DOMRect): { top: number; bottom: number } => ({
			top: r.top,
			bottom: r.bottom
		});
		const painted =
			own.querySelector('.task-checkbox') ?? own.querySelector('.md-marker-box') ?? own;
		const content = item.querySelector(':scope > .list-item-content')!;
		const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
		let firstText = null;
		for (let t = walker.nextNode(); t; t = walker.nextNode()) {
			const at = t.textContent!.search(/\S/);
			if (at < 0 || t.parentElement!.closest('.md-marker[contenteditable="false"]')) continue;
			const range = document.createRange();
			range.setStart(t, at);
			range.setEnd(t, at + 1);
			// A fence line hidden by the mode has no box; the first line is the next one that paints.
			const rect = range.getClientRects()[0];
			if (!rect) continue;
			firstText = band(rect);
			break;
		}
		const block = content.querySelector<HTMLElement>('.text-editable-block');
		let firstLine = null;
		if (block) {
			const style = getComputedStyle(block);
			const top = block.getBoundingClientRect().top + parseFloat(style.paddingTop);
			firstLine = { top, bottom: top + parseFloat(style.lineHeight) };
		}
		const style = getComputedStyle(own);
		return {
			marker: band(painted.getBoundingClientRect()),
			visibility: style.visibility,
			opacity: parseFloat(style.opacity),
			text: own.textContent ?? '',
			firstText,
			firstLine
		};
	}, nth);
}

const centre = (b: Band) => (b.top + b.bottom) / 2;

async function openIn(page: Page, mode: PresentationMode, md: string): Promise<EditorPage> {
	const editor = new EditorPage(page);
	await editor.goto(mode === 'source' ? '' : `?presentationMode=${mode}`);
	await editor.loadContent(md);
	return editor;
}

/** Clicks a few pixels into the item's own marker, where a bullet or a number paints. */
async function clickMarker(page: Page): Promise<void> {
	const { marker } = await readMarker(page);
	const left = await page.evaluate(() => {
		const item = document.querySelector('.editor .list-item-block')!;
		return item.getBoundingClientRect().left;
	});
	await page.mouse.click(left + 3, centre(marker));
}

const MODES = ['source', 'live', 'reading'] as const;
const EDITING_MODES = ['source', 'live'] as const;
const EMPTY = ['- ', '1. ', '- [ ] '];

test.describe('an empty item', () => {
	for (const mode of MODES) {
		for (const marker of EMPTY) {
			test(`\`${marker.trim()}\` marker sits on the item's line, ${mode}`, async ({ page }) => {
				await openIn(page, mode, `${marker}\n`);
				const read = await readMarker(page);
				const line = read.firstLine!;
				// Centred on the empty line: a marker held to the item's top or bottom edge is a few pixels off.
				expect(Math.abs(centre(read.marker) - centre(line))).toBeLessThanOrEqual(2);
			});
		}
	}

	for (const mode of EDITING_MODES) {
		for (const marker of EMPTY) {
			test(`a press on the \`${marker.trim()}\` marker, then typing, ${mode}`, async ({ page }) => {
				const editor = await openIn(page, mode, `${marker}\n`);
				await clickMarker(page);
				await editor.typeSlowly('z');
				// The rendered box is a control: its press checks the to-do, and the caret lands too.
				const toggled = mode === 'live' && marker === '- [ ] ' ? '- [x] ' : marker;
				await editor.bridge.waitForSourceEquals(`${toggled}z\n`);
			});
		}
	}

	for (const marker of ['- ', '- [ ] ']) {
		test(`a press on the \`${marker.trim()}\` marker writes nothing, reading`, async ({ page }) => {
			const editor = await openIn(page, 'reading', `${marker}\n`);
			await clickMarker(page);
			await editor.waitForRenderFlush();
			expect(await editor.bridge.getSource()).toBe(`${marker}\n`);
		});
	}

	for (const mode of EDITING_MODES) {
		for (const marker of ['- ', '- [ ] ']) {
			test(`IME composes at the start of an empty \`${marker.trim()}\` item, ${mode}`, async ({
				page
			}) => {
				const editor = await openIn(page, mode, `${marker}\n`);
				await editor.focusBlockAtPath([0, 0, 0], 0);
				const ime = await attachIme(page);
				await ime.compose('か');
				await ime.compose('かん');
				await ime.commit('かん');
				await editor.bridge.waitForSourceEquals(`${marker}かん\n`);
			});
		}
	}
});

const NON_PROSE = {
	'a code block': { md: '- ```\n  code line\n  ```\n', bytes: '- ' },
	'a quote': { md: '1. > quoted\n', bytes: '1. ' },
	'a table': { md: '- | a | b |\n  | - | - |\n  | 1 | 2 |\n', bytes: '- ' },
	'a nested list': { md: '- - nested\n', bytes: '- ' }
} as const;

test.describe('an item that opens with a block other than text', () => {
	for (const mode of MODES) {
		for (const [shape, { md }] of Object.entries(NON_PROSE)) {
			test(`${shape}: the marker paints beside its first line, ${mode}`, async ({ page }) => {
				await openIn(page, mode, md);
				const read = await readMarker(page);
				const first = read.firstText!;
				expect(Math.abs(centre(read.marker) - centre(first))).toBeLessThanOrEqual(
					(first.bottom - first.top) / 2
				);
				// The bullet's bytes hide under the drawn `•`; a number or a source marker shows itself.
				const drawn = await page.evaluate(() => {
					const box = document.querySelector('.editor .list-item-block .md-marker-box')!;
					return getComputedStyle(box, '::before').content;
				});
				expect(read.visibility === 'visible' || drawn.includes('•')).toBe(true);
			});
		}
	}

	for (const [shape, { md, bytes }] of Object.entries(NON_PROSE)) {
		test(`${shape}: source mode shows the marker's bytes`, async ({ page }) => {
			await openIn(page, 'source', md);
			const read = await readMarker(page);
			expect(read.text).toBe(bytes);
			expect(read.visibility).toBe('visible');
			expect(read.opacity).toBeGreaterThan(0.3);
		});
	}

	test('a nested list in source mode shows both markers', async ({ page }) => {
		await openIn(page, 'source', '- - nested\n');
		const [outer, inner] = [await readMarker(page, 0), await readMarker(page, 1)];
		expect(outer.text + inner.text).toBe('- - ');
		expect([outer.visibility, inner.visibility]).toEqual(['visible', 'visible']);
	});
});

test.describe('later blocks of an item', () => {
	for (const mode of MODES) {
		test(`start at the item's text column, ${mode}`, async ({ page }) => {
			await openIn(page, mode, '- first para\n\n  second para\n\n  ```\n  code\n  ```\n');
			const lefts = await page.evaluate(() => {
				const hosts = document.querySelectorAll<HTMLElement>(
					'.editor .list-item-block > .list-item-content > .block-list > .block-host'
				);
				const textLeft = (host: HTMLElement) => {
					const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
					for (let t = walker.nextNode(); t; t = walker.nextNode()) {
						if (!t.textContent!.trim() || t.parentElement!.closest('.md-marker')) continue;
						const range = document.createRange();
						range.selectNodeContents(t);
						return range.getClientRects()[0].left;
					}
					return NaN;
				};
				return {
					first: textLeft(hosts[0]),
					second: textLeft(hosts[1]),
					code: hosts[2].getBoundingClientRect().left
				};
			});
			expect(Math.abs(lefts.second - lefts.first)).toBeLessThanOrEqual(0.5);
			expect(Math.abs(lefts.code - lefts.first)).toBeLessThanOrEqual(0.5);
		});
	}
});

test.describe('the caret at an item’s start', () => {
	for (const mode of EDITING_MODES) {
		for (const marker of ['- ', '1. ', '10. ']) {
			test(`a press on the \`${marker.trim()}\` marker lands before the text, ${mode}`, async ({
				page
			}) => {
				const editor = await openIn(page, mode, `${marker}alpha\n`);
				await clickMarker(page);
				await editor.typeSlowly('X');
				await editor.bridge.waitForSourceEquals(`${marker}Xalpha\n`);
			});
		}
	}

	for (const mode of ['live', 'preview-block'] as const) {
		test(`a press on the drawn box checks it and leaves the caret in the to-do, ${mode}`, async ({
			page
		}) => {
			const editor = await openIn(page, mode, '- [ ] alpha\n');
			await page.locator('.task-checkbox').click();
			await editor.typeSlowly('X');
			await editor.bridge.waitForSourceEquals('- [x] Xalpha\n');
		});
	}

	test('Select all inside the item takes its text, not its marker', async ({ page }) => {
		const editor = await openIn(page, 'source', '- Hello\n');
		await editor.clickBlockAtPath([0, 0, 0], 2);
		await page.keyboard.press('ControlOrMeta+KeyA');
		expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('Hello');
		await editor.typeText('World');
		await editor.bridge.waitForSourceEquals('- World\n');
	});

	test('typing after `- ` turns a paragraph into an item lands in the item', async ({ page }) => {
		const editor = await openIn(page, 'source', '\n');
		await editor.focusBlockEnd(0);
		await page.keyboard.type('- ');
		await page.keyboard.type('a');
		await editor.bridge.waitForSourceContains('- a');
	});
});

test.describe('preview-block', () => {
	test('the focused item shows its marker’s bytes, dimmed', async ({ page }) => {
		const editor = await openIn(page, 'preview-block', '- alpha\n- beta\n');
		await editor.clickBlockAtPath([0, 0, 0], 2);
		const [focused, other] = [await readMarker(page, 0), await readMarker(page, 1)];
		expect(focused.visibility).toBe('visible');
		expect(focused.opacity).toBeLessThan(1);
		const drawn = await page.evaluate(() =>
			[...document.querySelectorAll('.editor .list-item-block .md-marker-box')].map(
				(box) => getComputedStyle(box, '::before').content
			)
		);
		expect(drawn[0]).toMatch(/^(none|normal)$/);
		expect(other.visibility).toBe('hidden');
		expect(drawn[1]).toContain('•');
	});
});
