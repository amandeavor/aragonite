import { test } from '../../fixtures';
import { EditorPage } from '../../editor-page';

// A cut or a paste inside one block is its own undo entry, apart from the typing on either side.
// Requirements: `e2e/requirements/clipboard/clipboard-undo-entry.md`.

const SURFACES = [
	{ name: 'a paragraph', doc: 'ab\n', path: [0], end: 2, typed: 'abxy\n' },
	{ name: 'a code block', doc: '```\nab\n```\n', path: [0], end: 6, typed: '```\nabxy\n```\n' },
	{
		name: 'a table cell',
		doc: '| h |\n| --- |\n| ab |\n',
		path: [0, 1, 0],
		end: 2,
		typed: '| h |\n| --- |\n| abxy |\n'
	}
];

test.describe('a cut or paste is its own undo entry', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.seedClipboard('PASTE');
	});

	for (const surface of SURFACES) {
		test(`Ctrl+V right after typing in ${surface.name} undoes alone`, async () => {
			await editor.loadContent(surface.doc);
			await editor.focusBlockAtPath(surface.path, surface.end);
			await editor.typeText('xy');
			await editor.bridge.waitForSourceEquals(surface.typed);
			await editor.paste();
			await editor.bridge.waitForSourceContains('PASTE');

			await editor.undo();
			await editor.bridge.waitForSourceEquals(surface.typed);
		});

		test(`typing right after Ctrl+V in ${surface.name} undoes without the paste`, async () => {
			await editor.loadContent(surface.doc);
			await editor.focusBlockAtPath(surface.path, surface.end);
			await editor.paste();
			await editor.bridge.waitForSourceContains('PASTE');
			const pasted = await editor.bridge.getSource();
			await editor.typeText('z');
			await editor.bridge.waitForSourceContains('PASTEz');

			await editor.undo();
			await editor.bridge.waitForSourceEquals(pasted);
		});

		test(`Ctrl+X right after typing in ${surface.name} undoes alone`, async ({ page }) => {
			await editor.loadContent(surface.doc);
			await editor.focusBlockAtPath(surface.path, surface.end);
			await editor.typeText('xy');
			await editor.bridge.waitForSourceEquals(surface.typed);
			await page.keyboard.press('Shift+ArrowLeft');
			await page.keyboard.press('ControlOrMeta+x');
			await editor.bridge.waitForSource((s) => !s.includes('xy'));

			await editor.undo();
			await editor.bridge.waitForSourceEquals(surface.typed);
		});
	}
});
