import type { Page } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';
import { waitForAllImagesLoaded } from '../image/helpers';
import type { PresentationMode } from '../../../../presentation-mode';

// Requirements: `e2e/requirements/blocks/list/marker-column.md`.

interface Line {
	top: number;
	left: number;
}

interface BlockGeometry {
	/** The block's painted bytes, one entry per line box, top to bottom. */
	lines: Line[];
	marker: { top: number } | null;
	image: { top: number } | null;
	lineHeight: number;
}

/** Reads the lines the editor paints for the block at `path` (through its own offset mapping),
 *  the marker of the item the block opens, and the block's first picture. */
function blockGeometry(page: Page, path: number[]): Promise<BlockGeometry> {
	return page.evaluate((at) => {
		const bridge = (window as any).__test;
		let node = bridge.getDocument();
		for (const i of at) node = node.children[i];
		const host = document.querySelector(`.editor [data-block-path='${JSON.stringify(at)}']`);
		const block = host?.querySelector<HTMLElement>('.text-editable-block');
		if (!block) throw new Error(`no text block at ${JSON.stringify(at)}`);
		const lineHeight = parseFloat(getComputedStyle(block).lineHeight);
		const rects = (bridge.rects.rangeRects(at, 0, node.raw.length) as DOMRect[])
			.filter((r) => r.width > 0)
			.sort((a, b) => a.top - b.top);
		const lines: Line[] = [];
		for (const rect of rects) {
			const line = lines.at(-1);
			if (line && rect.top - line.top < lineHeight / 2) line.left = Math.min(line.left, rect.left);
			else lines.push({ top: rect.top, left: rect.left });
		}
		const top = (el: Element | null) => (el ? { top: el.getBoundingClientRect().top } : null);
		return {
			lines,
			marker: top(
				host!.closest('.list-item-block')!.querySelector(':scope > .list-item-marker > .md-marker')
			),
			image: top(block.querySelector('[data-image-widget] img')),
			lineHeight
		};
	}, path);
}

async function openIn(page: Page, mode: PresentationMode, md: string): Promise<void> {
	const editor = new EditorPage(page);
	await editor.goto(mode === 'source' ? '' : `?presentationMode=${mode}`);
	await editor.loadContent(md);
}

const HALF_PIXEL = 0.5;
const LONG =
	'which page should they land on? the empty source, a welcome note, or a project '.repeat(3);

const MARKERS = ['- ', '1. ', '9. ', '10. ', '100. ', '- [ ] ', '- [x] '];
const WRAP_MODES: PresentationMode[] = ['source', 'live', 'reading', 'preview-block'];

test.describe('wrapped text lines up under the first line', () => {
	for (const mode of WRAP_MODES) {
		for (const marker of MARKERS) {
			test(`\`${marker.trim()}\` item, hard break, ${mode}`, async ({ page }) => {
				await openIn(page, mode, `${marker}alpha\\\n${' '.repeat(marker.length)}bravo\n`);
				const { lines } = await blockGeometry(page, [0, 0, 0]);
				expect(lines).toHaveLength(2);
				expect(Math.abs(lines[1].left - lines[0].left)).toBeLessThanOrEqual(HALF_PIXEL);
			});
		}
	}

	for (const mode of ['source', 'live'] as const) {
		for (const marker of ['3. ', '- ']) {
			test(`\`${marker.trim()}\` item, soft wrap, ${mode}`, async ({ page }) => {
				await openIn(page, mode, `${marker}${LONG}\n`);
				const { lines } = await blockGeometry(page, [0, 0, 0]);
				expect(lines.length).toBeGreaterThan(1);
				expect(Math.abs(lines[1].left - lines[0].left)).toBeLessThanOrEqual(HALF_PIXEL);
			});
		}
	}
});

// Live paints no marker text for a bullet or a to-do (the bullet and box are drawn), so only the
// numbers have glyphs to measure there.
const FIT_ROWS = [
	...MARKERS.map((marker) => ({ marker, mode: 'source' as const })),
	...['1. ', '9. ', '10. ', '100. '].map((marker) => ({ marker, mode: 'live' as const })),
	...['1. # ', '10. # ', '100. # '].flatMap((marker) =>
		(['source', 'live'] as const).map((mode) => ({ marker, mode }))
	)
];

test.describe('the marker fits inside its column', () => {
	for (const { marker, mode } of FIT_ROWS) {
		test(`\`${marker.trim()}\` item, ${mode}`, async ({ page }) => {
			await openIn(page, mode, `${marker}alpha\n`);
			const { lines } = await blockGeometry(page, [0, 0, 0]);
			// The right edge of the marker text the mode paints; a hidden `- ` paints nothing.
			const glyphsRight = await page.evaluate(() => {
				const marker = document.querySelector('.editor .md-marker[contenteditable="false"]')!;
				const walker = document.createTreeWalker(marker, NodeFilter.SHOW_TEXT);
				let right = -Infinity;
				for (let text = walker.nextNode(); text; text = walker.nextNode()) {
					const style = getComputedStyle(text.parentElement!);
					if (style.visibility !== 'visible' || style.color === 'rgba(0, 0, 0, 0)') continue;
					const range = document.createRange();
					range.selectNodeContents(text);
					for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
				}
				return right;
			});
			expect(glyphsRight).toBeLessThanOrEqual(lines[0].left + HALF_PIXEL);
		});
	}
});

test.describe('an item paints its own marker, not its parent item’s', () => {
	const NESTED = [
		{ shape: 'ordered in a bullet', md: '- outer\n  1. inner\n', kind: 'ordered' },
		{ shape: 'to-do in a bullet', md: '- outer\n  - [ ] inner\n', kind: 'task' },
		{ shape: 'bullet in an ordered', md: '1. outer\n   - inner\n', kind: 'bullet' }
	] as const;
	for (const mode of ['live', 'reading'] as const) {
		for (const { shape, md, kind } of NESTED) {
			test(`${shape}, ${mode}`, async ({ page }) => {
				await openIn(page, mode, md);
				const paint = await page.evaluate((k) => {
					const item = document.querySelector(
						`.editor .list-item-block .list-item-block[data-list-marker='${k}']`
					);
					const marker = item!.querySelector<HTMLElement>('.md-marker[contenteditable="false"]')!;
					const box = marker.querySelector('.md-marker-box')!;
					return {
						bullet: getComputedStyle(box, '::before').content,
						bytes: getComputedStyle(marker).visibility
					};
				}, kind);
				// A bullet paints `•` over its hidden `- `; a number or a box paints no bullet beside it.
				if (kind === 'bullet') {
					expect(paint.bullet).toContain('•');
					expect(paint.bytes).toBe('hidden');
				} else expect(paint.bullet).toMatch(/^(none|normal)$/);
			});
		}
	}
});

test.describe('a heading item draws its marker as part of the heading', () => {
	for (const mode of ['source', 'live', 'reading'] as const) {
		for (const marker of ['1. ', '10. ', '100. ', '- ']) {
			test(`\`${marker.trim()}\` heading item, ${mode}`, async ({ page }) => {
				await openIn(
					page,
					mode,
					`${marker}# ${LONG}
`
				);
				await expect(page.locator('.heading-1')).toHaveCount(1);
				const { lines } = await blockGeometry(page, [0, 0, 0]);
				expect(lines.length).toBeGreaterThan(1);
				expect(Math.abs(lines[1].left - lines[0].left)).toBeLessThanOrEqual(HALF_PIXEL);
				const font = await page.evaluate(() => {
					const heading = document.querySelector<HTMLElement>('.editor .heading-1')!;
					const marker = heading
						.closest('.list-item-block')!
						.querySelector(':scope > .list-item-marker > .md-marker')!;
					const [h, m] = [getComputedStyle(heading), getComputedStyle(marker)];
					return {
						heading: { size: h.fontSize, weight: h.fontWeight },
						marker: { size: m.fontSize, weight: m.fontWeight }
					};
				});
				expect(font.marker.size).toBe(font.heading.size);
				// Source mode draws every marker as plain-weight syntax, the heading's own `#` included.
				if (mode !== 'source') expect(font.marker.weight).toBe(font.heading.weight);
			});
		}
	}
});

test.describe('the marker sits beside the first line', () => {
	const PICTURE = '![pic|300x200](/test-fixtures/sample.png)';
	const FIRST_LINES = {
		text: { md: `1. ${LONG}\n`, line: 'text' },
		'picture only': { md: `1. ${PICTURE}\n`, line: 'image' },
		'picture then caption': { md: `1. ${PICTURE} caption\n`, line: 'image' },
		'text then picture': { md: `1. lead ${PICTURE}\n`, line: 'text' }
	} as const;

	for (const mode of ['source', 'live', 'reading'] as const) {
		for (const [shape, { md, line }] of Object.entries(FIRST_LINES)) {
			test(`${shape}, ${mode}`, async ({ page }) => {
				await openIn(page, mode, md);
				await waitForAllImagesLoaded(page);
				const geometry = await blockGeometry(page, [0, 0, 0]);
				const first = line === 'image' ? geometry.image : geometry.lines[0];
				if (!first || !geometry.marker) throw new Error('layout boxes missing');
				// Within half a line of the first line's top: a marker on any later line is a line off.
				expect(Math.abs(geometry.marker.top - first.top)).toBeLessThanOrEqual(
					geometry.lineHeight / 2
				);
			});
		}
	}
});

test.describe('the marker column holds no caret', () => {
	for (const mode of ['source', 'live'] as const) {
		for (const marker of ['- ', '1. ', '- [ ] ']) {
			test(`End in an empty \`${marker.trim()}\` item, then typing, ${mode}`, async ({ page }) => {
				await openIn(page, mode, `${marker}\n`);
				const editor = new EditorPage(page);
				await editor.clickBlockAtPath([0, 0, 0], 0);
				await page.keyboard.press('End');
				await page.keyboard.type('z');
				await editor.bridge.waitForSourceEquals(`${marker}z\n`);
			});
		}
	}
});

/** Where each top-level item's text column starts, item by item. */
const textColumns = (page: Page): Promise<number[]> =>
	page.evaluate(() =>
		[...document.querySelectorAll('.editor .list-block > .list-item-block')]
			.filter((item) => !item.parentElement!.closest('.list-item-block'))
			.map(
				(item) => item.querySelector(':scope > .list-item-content')!.getBoundingClientRect().left
			)
	);

const spread = (lefts: number[]) => Math.max(...lefts) - Math.min(...lefts);

test.describe('one marker column per list', () => {
	const LISTS = {
		'`9.` and `10.`': '8. a\n9. b\n10. c\n',
		'`99.` and `100.`': '99. a\n100. b\n',
		'a bullet beside a to-do': '- a\n- [ ] b\n- c\n'
	};
	for (const mode of ['source', 'live', 'reading'] as const) {
		for (const [shape, md] of Object.entries(LISTS)) {
			test(`${shape} start their text in one column, ${mode}`, async ({ page }) => {
				await openIn(page, mode, md);
				const lefts = await textColumns(page);
				expect(lefts.length).toBeGreaterThan(1);
				expect(spread(lefts)).toBeLessThanOrEqual(HALF_PIXEL);
			});
		}
	}

	for (const mode of ['source', 'live'] as const) {
		test(`an item typed into a to-do widens the whole list's column, ${mode}`, async ({ page }) => {
			await openIn(page, mode, '- a\n- b\n- c\n');
			const editor = new EditorPage(page);
			const before = await textColumns(page);
			await editor.clickBlockAtPath([0, 1, 0], 0);
			await page.keyboard.type('[ ] ');
			await editor.bridge.waitForSourceEquals('- a\n- [ ] b\n- c\n');
			await expect
				.poll(async () => spread(await textColumns(page)))
				.toBeLessThanOrEqual(HALF_PIXEL);
			expect((await textColumns(page))[0]).toBeGreaterThan(before[0]);
		});
	}
});
