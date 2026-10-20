import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { focusWalkKey } from '../../platform-keys';
import { clickInPlace } from '../../click-in-place';
import { blockView, capturedErrors, tocEntry } from './helpers';
import { FootnotePage } from './footnotes-helpers';

// Every reading-mode jump, then Tab and Shift+Tab, then leaving reading mode
// (requirements/plugins/reading-jump-focus.md): focus lands on the jump's target with no caret,
// Tab continues from it on every engine, and leaving reading mode puts the caret there.

// A capped viewport keeps the far blocks unmounted, so each jump has to mount its target.
test.use({ viewport: { width: 1000, height: 700 } });

const FILLER = 120;
const TABLE = '| Cell |\n| --- |\n| Cites [^c] |';

/** `[[toc]]`, the citing blocks, filler, a far heading, then the definitions. */
function jumpDoc() {
	const parts = [
		'[[toc]]',
		'Lead paragraph.',
		// A link and another reference come before `[^a]`, so a back-jump that landed on the block
		// rather than the reference would put Tab somewhere else.
		'See [a link](https://example.com), [^b] and then [^a] here.',
		'Between the citations.',
		TABLE,
		'After the table.'
	];
	for (let i = 0; i < FILLER; i++)
		parts.push(`Filler paragraph ${i} with enough words to fill a line.`);
	const heading = parts.length;
	parts.push('## Far Heading', 'After the heading.');
	const defA = parts.length;
	parts.push('[^a]: First note.', '[^b]: Second note.', '[^c]: Cell note.');
	return { md: parts.join('\n\n') + '\n', heading, defA, defC: defA + 2 };
}

const { md, heading, defA, defC } = jumpDoc();

/** What holds focus, named the way the assertions read: a block's own element, a footnote
 *  reference or marker in a block, or somewhere outside the editor. */
function focusedTarget(page: Page): Promise<string> {
	return page.evaluate(() => {
		const active = document.activeElement;
		const path = active?.closest('[data-block-path]')?.getAttribute('data-block-path');
		if (!active || !path) return 'outside';
		if (active.classList.contains('footnote-ref')) return `ref ${active.textContent} in ${path}`;
		if (active.classList.contains('footnote-def-marker')) return `marker in ${path}`;
		return `block ${path}`;
	});
}

/** Whether the browser holds a range anywhere in the editor. */
function holdsCaret(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const sel = getSelection();
		const editor = document.querySelector('.editor');
		return !!sel && sel.rangeCount > 0 && !!editor?.contains(sel.anchorNode);
	});
}

class JumpPage extends FootnotePage {
	async jumpToDefA(how: 'Enter' | 'click'): Promise<void> {
		const ref = this.refs(2).nth(1);
		if (how === 'click') await clickInPlace(ref);
		else {
			await ref.focus();
			await this.page.keyboard.press('Enter');
		}
		await expect.poll(() => blockView(this.page, [defA])).toEqual({ mounted: true, inView: true });
	}

	/** Follows `[^c]` out of the table cell. */
	async jumpToDefC(): Promise<void> {
		await this.refs(4).nth(0).focus();
		await this.page.keyboard.press('Enter');
		await expect.poll(() => blockView(this.page, [defC])).toEqual({ mounted: true, inView: true });
	}

	async followMarker(def: number, how: 'Enter' | 'click', back: number): Promise<void> {
		if (how === 'click') await clickInPlace(this.defMarker(def));
		else {
			await this.page.keyboard.press(focusWalkKey());
			await expect(this.defMarker(def)).toBeFocused();
			await expect(this.defMarker(def)).toHaveAccessibleName(/^Back to reference /);
			await this.page.keyboard.press('Enter');
		}
		await expect.poll(() => blockView(this.page, [back])).toEqual({ mounted: true, inView: true });
	}

	async followTocEntry(how: 'Enter' | 'click'): Promise<void> {
		const entry = tocEntry(this.page, 'Far Heading');
		if (how === 'click') await clickInPlace(entry);
		else {
			await entry.focus();
			await this.page.keyboard.press('Enter');
		}
		await expect
			.poll(() => blockView(this.page, [heading]))
			.toEqual({ mounted: true, inView: true });
	}
}

interface Route {
	name: string;
	jump(editor: JumpPage): Promise<void>;
	/** Where focus lands, then where Tab and Shift+Tab take it. */
	lands: string;
	tab: string;
	shiftTab: string;
}

const ROUTES: Route[] = [
	...(['Enter', 'click'] as const).map((how) => ({
		name: `reference to definition (${how})`,
		jump: (editor: JumpPage) => editor.jumpToDefA(how),
		lands: `block [${defA},0]`,
		tab: `marker in [${defA},0]`,
		shiftTab: 'outside'
	})),
	...(['Enter', 'click'] as const).map((how) => ({
		name: `marker back to its reference (${how})`,
		jump: async (editor: JumpPage) => {
			await editor.jumpToDefA('Enter');
			await editor.followMarker(defA, how, 2);
		},
		lands: 'ref 2 in [2]',
		tab: 'ref 3 in [4]',
		shiftTab: 'ref 1 in [2]'
	})),
	{
		name: 'marker back to a reference in a table cell',
		jump: async (editor: JumpPage) => {
			await editor.jumpToDefC();
			await editor.followMarker(defC, 'Enter', 4);
		},
		lands: 'ref 3 in [4]',
		tab: 'outside',
		shiftTab: 'block [4]'
	},
	...(['Enter', 'click'] as const).map((how) => ({
		name: `table of contents entry to its heading (${how})`,
		jump: (editor: JumpPage) => editor.followTocEntry(how),
		lands: `block [${heading}]`,
		tab: `marker in [${defA},0]`,
		shiftTab: 'outside'
	}))
];

test.describe('reading mode: a jump lands focus where Tab continues', () => {
	for (const route of ROUTES) {
		for (const key of ['Tab', 'Shift+Tab'] as const) {
			test(`${route.name}, then ${key}`, async ({ page }) => {
				const editor = new JumpPage(page);
				await editor.load(md, 'reading');
				await route.jump(editor);

				await expect.poll(() => focusedTarget(page)).toBe(route.lands);
				expect(await holdsCaret(page)).toBe(false);
				expect(await editor.bridge.getSelection()).toBeNull();

				await page.keyboard.press(focusWalkKey({ backward: key === 'Shift+Tab' }));
				await expect
					.poll(() => focusedTarget(page))
					.toBe(key === 'Tab' ? route.tab : route.shiftTab);
				expect(await capturedErrors(page)).toEqual([]);
			});
		}
	}

	// A host's own navigation button lands through the same `navigateTo` a footnote does.
	test("a host's navigateTo into a table cell's text leaves no selection either", async ({
		page
	}) => {
		const editor = new JumpPage(page);
		await editor.load(md, 'reading');
		const inView = await page.evaluate(
			([path, offset]) => (window as any).__test.rects.navigateTo(path, offset),
			[[4], TABLE.indexOf('Cites')] as const
		);
		expect(inView).toBe(true);

		await expect.poll(() => focusedTarget(page)).toBe('block [4]');
		expect(await holdsCaret(page)).toBe(false);
		expect(await editor.bridge.getSelection()).toBeNull();
		expect(await capturedErrors(page)).toEqual([]);
	});
});

/** Leaves reading mode the way a host does: from its own button, which takes focus out of the
 *  editor, or from a shortcut, which leaves focus where it was. */
async function leaveReading(editor: JumpPage, from: 'host button' | 'shortcut'): Promise<void> {
	if (from === 'host button') {
		await editor.page.evaluate(() => {
			const button = document.createElement('button');
			button.id = 'host-mode-button';
			button.textContent = 'Edit';
			button.style.cssText = 'position: fixed; top: 0; right: 0; z-index: 10';
			// WebKit doesn't focus a clicked button, so this host focuses it itself.
			button.addEventListener('click', () => button.focus());
			document.body.append(button);
		});
		await clickInPlace(editor.page.locator('#host-mode-button'));
		await expect(editor.page.locator('#host-mode-button')).toBeFocused();
	}
	await editor.setPresentationMode('source');
}

test.describe('reading mode: leaving it after a jump puts the caret at the jump', () => {
	const FLIPS = [
		{
			name: 'reference to definition',
			jump: (editor: JumpPage) => editor.jumpToDefA('Enter'),
			typed: '[^a]: XFirst note.'
		},
		{
			name: 'marker back to its reference',
			jump: async (editor: JumpPage) => {
				await editor.jumpToDefA('Enter');
				await editor.followMarker(defA, 'Enter', 2);
			},
			typed: 'then [^a]X here.'
		}
	];
	for (const flip of FLIPS) {
		for (const from of ['host button', 'shortcut'] as const) {
			test(`${flip.name}, then source mode from a ${from}, then a typed letter`, async ({
				page
			}) => {
				const editor = new JumpPage(page);
				await editor.load(md, 'reading');
				await flip.jump(editor);

				await leaveReading(editor, from);
				await page.keyboard.type('X');
				await editor.bridge.waitForSourceContains(flip.typed);
			});
		}
	}
});
