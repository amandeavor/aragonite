import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';

test.describe('selection: keyboard: collapse', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('ArrowLeft collapses to range start', async () => {
		await editor.loadContent('aaa\n\nbbb\n\nccc\n');
		await editor.focusBlockEnd(0);
		await editor.page.keyboard.press('Shift+ArrowDown');
		await editor.waitForCrossBlock(true);
		const before = await editor.bridge.getSelectionPaths();
		await editor.page.keyboard.press('ArrowLeft');
		await editor.waitForCrossBlock(false);
		const focused = await editor.page.evaluate(() => {
			const el = document.activeElement?.closest('[data-block-path]');
			return el ? JSON.parse(el.getAttribute('data-block-path')!) : null;
		});
		expect(focused).toEqual(before!.anchor.path);
	});

	test('ArrowRight collapses to range end', async () => {
		await editor.loadContent('aaa\n\nbbb\n');
		await editor.focusBlockEnd(0);
		await editor.page.keyboard.press('Shift+ArrowDown');
		await editor.waitForCrossBlock(true);
		const before = await editor.bridge.getSelectionPaths();
		await editor.page.keyboard.press('ArrowRight');
		await editor.waitForCrossBlock(false);
		const focused = await editor.page.evaluate(() => {
			const el = document.activeElement?.closest('[data-block-path]');
			return el ? JSON.parse(el.getAttribute('data-block-path')!) : null;
		});
		expect(focused).toEqual(before!.focus.path);
	});
});

// Three equal lines, so a column in one block is the same offset in its neighbour.
const LINE = '0123456789';
const THREE = [LINE, LINE, LINE];
const join = (blocks: string[]) => blocks.join('\n\n') + '\n';
const withQ = (text: string, at: number) => text.slice(0, at) + 'Q' + text.slice(at);

/** `blocks` with `Q` typed into block `index` at `at`, or into a new block past the end. */
function landed(blocks: string[], index: number, at: number): string {
	if (index === blocks.length) return join([...blocks, 'Q']);
	return join(blocks.map((text, i) => (i === index ? withQ(text, at) : text)));
}

interface ArrowRow {
	key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
	/** The range, built from a caret at `from` by `steps` Shift+Arrow presses (negative: leftward). */
	from: number;
	steps: number;
	/** Where `Q` lands for a range in block `i` of three. */
	expect(i: number): string;
}

// Left and Right collapse to the end they name; Up and Down move from the moving end, which each
// range puts away from the end the key names, so a move from the wrong end lands elsewhere.
const ARROW_ROWS: ArrowRow[] = [
	{ key: 'ArrowLeft', from: 0, steps: 3, expect: (i) => landed(THREE, i, 0) },
	{ key: 'ArrowRight', from: 10, steps: -3, expect: (i) => landed(THREE, i, 10) },
	{ key: 'ArrowUp', from: 3, steps: 3, expect: (i) => landed(THREE, Math.max(0, i - 1), 6) },
	{ key: 'ArrowDown', from: 6, steps: -3, expect: (i) => landed(THREE, i + 1, 3) }
];

const BLOCKS = [
	{ name: 'first', index: 0 },
	{ name: 'middle', index: 1 },
	{ name: 'last', index: 2 }
];

/** Trailing whitespace aside, since a block appended at the end changes how the source ends. */
async function expectSource(editor: EditorPage, expected: string) {
	const trim = (text: string) => text.replace(/\s+$/, '');
	await editor.bridge.waitForSource((source) => trim(source) === trim(expected));
}

async function selectFrom(editor: EditorPage, path: number[], from: number, steps: number) {
	await editor.focusBlockAtPath(path, from);
	const key = steps < 0 ? 'Shift+ArrowLeft' : 'Shift+ArrowRight';
	for (let n = 0; n < Math.abs(steps); n++) await editor.page.keyboard.press(key);
}

for (const mode of ['source', 'live'] as const) {
	test.describe(`selection: keyboard: a plain arrow over a range in one block (${mode})`, () => {
		let editor: EditorPage;

		test.beforeEach(async ({ page }) => {
			editor = new EditorPage(page);
			await editor.goto(`?presentationMode=${mode}`);
		});

		for (const row of ARROW_ROWS) {
			for (const block of BLOCKS) {
				test(`${row.key} over a range at the ${block.name} block's edge collapses before it moves`, async () => {
					await editor.loadContent(join(THREE));
					await selectFrom(editor, [block.index], row.from, row.steps);
					await editor.page.keyboard.press(row.key);
					await editor.page.keyboard.type('Q');
					await expectSource(editor, row.expect(block.index));
				});
			}
		}

		test('ArrowLeft over a range starting mid-block collapses at its start', async () => {
			await editor.loadContent(join(THREE));
			await selectFrom(editor, [1], 3, 3);
			await editor.page.keyboard.press('ArrowLeft');
			await editor.page.keyboard.type('Q');
			await expectSource(editor, landed(THREE, 1, 3));
		});

		// The line move after the collapse is the browser's own, from the caret the collapse left.
		for (const { key, from, steps, line, at } of [
			{ key: 'ArrowUp', from: 18, steps: 3, line: 0, at: 6 },
			{ key: 'ArrowDown', from: 21, steps: -3, line: 2, at: 3 }
		]) {
			test(`${key} over a range inside a code block collapses, then moves a line`, async () => {
				const fence = (lines: string[]) => '```\n' + lines.join('\n') + '\n```\n';
				await editor.loadContent(fence(THREE));
				await selectFrom(editor, [0], from, steps);
				await editor.page.keyboard.press(key);
				await editor.page.keyboard.type('Q');
				await expectSource(
					editor,
					fence(THREE.map((text, i) => (i === line ? withQ(text, at) : text)))
				);
			});
		}

		test('ArrowLeft over a range right after a decoded entity stops before crossing it', async () => {
			test.skip(mode !== 'live', 'source mode shows the entity as its bytes');
			await editor.loadContent('ab&amp;cd\n');
			await selectFrom(editor, [0], 7, 2);
			await editor.page.keyboard.press('ArrowLeft');
			await editor.page.keyboard.type('Q');
			await expectSource(editor, 'ab&amp;Qcd\n');
		});

		for (const { name, doc, start, expected } of [
			{
				name: 'a list item',
				doc: '- above\n- 0123\n',
				start: () => editor.focusBlockAtPath([0, 1, 0], 0),
				expected: '- above\n- Q0123\n'
			},
			{
				name: 'a table cell',
				doc: 'above\n\n| 0123 | x |\n| --- | --- |\n| a | b |\n',
				start: () => editor.focusBlockStart(1),
				expected: 'above\n\n| Q0123 | x |\n| --- | --- |\n| a | b |\n'
			},
			{
				name: 'a heading',
				doc: 'above\n\n## 0123\n',
				start: () => editor.focusBlockStart(1),
				expected: mode === 'live' ? 'above\n\n## Q0123\n' : 'above\n\nQ## 0123\n'
			}
		]) {
			test(`ArrowLeft over a range at the start of ${name} stays in it`, async () => {
				await editor.loadContent(doc);
				await start();
				for (let n = 0; n < 3; n++) await editor.page.keyboard.press('Shift+ArrowRight');
				await editor.page.keyboard.press('ArrowLeft');
				await editor.page.keyboard.type('Q');
				await expectSource(editor, expected);
			});
		}
	});
}
