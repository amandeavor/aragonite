import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { textRunEnd } from '../../text-runs';
import { clickEnd, clickWordSettled } from '../presentation/helpers';
import { waitForFirstImageLoaded } from '../blocks/image/helpers';
import { edgeKey, isMacOS } from '../../platform-keys';

// Every caret-edge site reads both spellings of its key: Home and End with their modifiers, and
// macOS's Cmd+Arrow. The chords are sent literally on every engine, so the Cmd+Arrow reading runs on
// every Linux push. Requirements: `requirements/keyboard-navigation/edge-chords.md`.

const IMAGE = '![pic](/test-fixtures/sample.png)';

interface EdgeRow {
	name: string;
	doc: string;
	live?: boolean;
	place: (ep: EditorPage, page: Page) => Promise<void>;
	/** The Windows and Linux spelling, and macOS's. */
	chords: { key: string; arrow: string };
	/** Whether the browser moves the caret for `key` itself, which macOS, scrolling, does not. */
	nativeKey?: boolean;
	/** The source once a `Z` is typed after the chord, or where the caret stands after it. */
	outcome: { typed: string } | { caret: { path: number[]; offset: number } };
}

/** A click on `word` once the image beside it has loaded, so the line's layout is final. */
function besideImage(word: string): EdgeRow['place'] {
	return async (ep, page) => {
		await waitForFirstImageLoaded(page);
		await clickWordSettled(ep, page, word);
	};
}

/** A click on the image, so it sits selected with its toolbar up. */
const selectImage: EdgeRow['place'] = async (ep, page) => {
	await waitForFirstImageLoaded(page);
	await page.locator('[data-image-widget]').first().click();
	await expect(page.locator('[data-image-overlay]')).toBeVisible();
};

// Mid-line and between blocks, so a key that leaves from the wrong edge, or that extends past the
// image or short of it, types somewhere else.
const SELECTED = `one\n\nbefore ${IMAGE} after\n\ntwo\n`;

const SELECTED_ROWS: EdgeRow[] = [
	{
		name: 'the block start from a selected image leaves the image',
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'ControlOrMeta+Home', arrow: 'Meta+ArrowUp' },
		nativeKey: true,
		outcome: { typed: `one\n\nZbefore ${IMAGE} after\n\ntwo\n` }
	},
	{
		name: 'the block end from a selected image leaves the image',
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'ControlOrMeta+End', arrow: 'Meta+ArrowDown' },
		nativeKey: true,
		outcome: { typed: `one\n\nbefore ${IMAGE} afterZ\n\ntwo\n` }
	},
	{
		name: 'extending to the line start from a selected image keeps the image',
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'Shift+Home', arrow: 'Shift+Meta+ArrowLeft' },
		nativeKey: true,
		outcome: { typed: 'one\n\nZ after\n\ntwo\n' }
	},
	{
		name: 'extending to the line end from a selected image keeps the image',
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'Shift+End', arrow: 'Shift+Meta+ArrowRight' },
		nativeKey: true,
		outcome: { typed: 'one\n\nbefore Z\n\ntwo\n' }
	},
	{
		name: "extending to the document's start from a selected image keeps the image",
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'ControlOrMeta+Shift+Home', arrow: 'Shift+Meta+ArrowUp' },
		outcome: { typed: 'Z after\n\ntwo\n' }
	},
	{
		name: "extending to the document's end from a selected image keeps the image",
		doc: SELECTED,
		place: selectImage,
		chords: { key: 'ControlOrMeta+Shift+End', arrow: 'Shift+Meta+ArrowDown' },
		outcome: { typed: 'one\n\nbefore Z\n' }
	}
];

const EDGE_ROWS: EdgeRow[] = [
	{
		name: 'the line start before a leading image types ahead of it',
		doc: `${IMAGE} tail\n`,
		place: besideImage('tail'),
		chords: { key: 'Home', arrow: 'Meta+ArrowLeft' },
		outcome: { typed: `Z${IMAGE} tail\n` }
	},
	{
		name: 'extending to the line start before a leading image takes the image',
		doc: `${IMAGE} tail\n`,
		place: async (ep, page) => {
			await waitForFirstImageLoaded(page);
			await clickEnd(ep, page, 'tail');
		},
		chords: { key: 'Shift+Home', arrow: 'Shift+Meta+ArrowLeft' },
		outcome: { typed: 'Z\n' }
	},
	{
		name: 'the block start before a leading image types ahead of it',
		doc: `${IMAGE} tail\n`,
		place: besideImage('tail'),
		chords: { key: 'ControlOrMeta+Home', arrow: 'Meta+ArrowUp' },
		outcome: { typed: `Z${IMAGE} tail\n` }
	},
	{
		name: 'the block end lands past a trailing image',
		doc: `text ${IMAGE}\n`,
		place: besideImage('text'),
		chords: { key: 'ControlOrMeta+End', arrow: 'Meta+ArrowDown' },
		outcome: { caret: { path: [0], offset: `text ${IMAGE}`.length } }
	},
	{
		name: 'the line end past a code chip types outside it',
		doc: 'see `code`\n',
		live: true,
		place: async (ep, page) => {
			const point = await textRunEnd(page, 'see');
			await page.mouse.click(point.x - 4, point.y);
			await ep.waitForRenderFlush();
		},
		chords: { key: 'End', arrow: 'Meta+ArrowRight' },
		nativeKey: true,
		outcome: { typed: 'see `code`Z\n' }
	},
	{
		name: 'the line start from a selected image leaves the image',
		doc: `before ${IMAGE} after\n`,
		place: selectImage,
		chords: { key: 'Home', arrow: 'Meta+ArrowLeft' },
		nativeKey: true,
		outcome: { typed: `Zbefore ${IMAGE} after\n` }
	},
	...SELECTED_ROWS,
	{
		name: 'the line start on the line Shift+Enter opened keeps that line',
		doc: 'abc\n',
		place: async (ep, page) => {
			await clickEnd(ep, page, 'abc');
			await page.keyboard.press('Shift+Enter');
			await ep.waitForRenderFlush();
		},
		chords: { key: 'Home', arrow: 'Meta+ArrowLeft' },
		outcome: { typed: 'abc\\\nZ\n' }
	},
	{
		name: "extending to the document's end takes every block after the caret",
		doc: 'one\n\ntwo\n',
		place: (ep, page) => clickEnd(ep, page, 'one'),
		chords: { key: 'ControlOrMeta+Shift+End', arrow: 'Shift+Meta+ArrowDown' },
		outcome: { typed: 'oneZ\n' }
	}
];

async function open(page: Page, doc: string, live = false): Promise<EditorPage> {
	const ep = new EditorPage(page);
	await ep.goto(live ? '?presentationMode=live' : '');
	await ep.loadContent(doc);
	return ep;
}

const focusOf = (ep: EditorPage) => ep.bridge.getSelectionPaths().then((sel) => sel?.focus);

test.describe('a caret-edge site reads both spellings of its key', () => {
	for (const row of EDGE_ROWS) {
		for (const spelling of ['key', 'arrow'] as const) {
			const chord = row.chords[spelling];
			test(`${chord}: ${row.name}`, async ({ page }) => {
				test.skip(
					isMacOS && spelling === 'key' && row.nativeKey === true,
					'macOS scrolls on Home and End, so the browser moves no caret for the key'
				);
				const ep = await open(page, row.doc, row.live);
				await row.place(ep, page);
				await page.keyboard.press(chord);
				await ep.waitForRenderFlush();
				const { outcome } = row;
				if ('caret' in outcome) {
					await expect.poll(() => focusOf(ep)).toEqual(outcome.caret);
					return;
				}
				await page.keyboard.press('Z');
				await expect.poll(() => ep.bridge.getSource()).toBe(outcome.typed);
			});
		}
	}
});

test.describe('Cmd+Arrow is an edge key, never a step across blocks', () => {
	test("Cmd+Up on a paragraph's first line keeps the caret in its block", async ({ page }) => {
		const ep = await open(page, 'one\n\ntwo\n');
		await clickWordSettled(ep, page, 'two');
		await page.keyboard.press('Meta+ArrowUp');
		await ep.waitForRenderFlush();
		expect((await focusOf(ep))?.path).toEqual([1]);
	});

	test("Cmd+Left at a block's start keeps the caret in its block", async ({ page }) => {
		const ep = await open(page, 'one\n\ntwo\n');
		await clickWordSettled(ep, page, 'two');
		await page.keyboard.press(edgeKey('lineStart'));
		await ep.waitForRenderFlush();
		await page.keyboard.press('Meta+ArrowLeft');
		await ep.waitForRenderFlush();
		expect(await focusOf(ep)).toEqual({ path: [1], offset: 0 });
	});

	test('Cmd+Up in a table cell keeps the caret in its cell', async ({ page }) => {
		const ep = await open(page, '| a | b |\n| - | - |\n| c | d |\n');
		await clickWordSettled(ep, page, 'd');
		const before = (await focusOf(ep))?.path;
		await page.keyboard.press('Meta+ArrowUp');
		await ep.waitForRenderFlush();
		expect((await focusOf(ep))?.path).toEqual(before);
	});

	// The reader reads the raw Meta flag: a folded Ctrl-or-Cmd would make this the line start the
	// leading image's site places.
	test('Ctrl+Left still steps a word on Windows and Linux', async ({ page }) => {
		test.skip(isMacOS, 'Ctrl+Arrow is no word step on macOS');
		const ep = await open(page, `${IMAGE} alpha beta\n`);
		await waitForFirstImageLoaded(page);
		await clickEnd(ep, page, 'beta');
		await page.keyboard.press('Control+ArrowLeft');
		await page.keyboard.press('Z');
		await expect.poll(() => ep.bridge.getSource()).toBe(`${IMAGE} alpha Zbeta\n`);
	});
});
