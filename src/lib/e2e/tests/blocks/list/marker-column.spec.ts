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
 *  the container's leading marker beside them, and the block's first picture. */
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
			marker: top(block.querySelector(':scope > .md-marker[contenteditable="false"]')),
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

test.describe('a heading item starts its text in the same column as a paragraph item', () => {
	for (const mode of ['source', 'live', 'reading'] as const) {
		for (const [shape, first, second] of [
			['ordered', '1. ', '2. '],
			['bullet', '- ', '- ']
		] as const) {
			test(`${shape}, ${mode}`, async ({ page }) => {
				await openIn(page, mode, `${first}alpha\n${second}# ${LONG}\n`);
				await expect(page.locator('.heading-1')).toHaveCount(1);
				const paragraph = await blockGeometry(page, [0, 0, 0]);
				const heading = await blockGeometry(page, [0, 1, 0]);
				expect(heading.lines.length).toBeGreaterThan(1);
				expect(Math.abs(heading.lines[1].left - paragraph.lines[0].left)).toBeLessThanOrEqual(
					HALF_PIXEL
				);
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
