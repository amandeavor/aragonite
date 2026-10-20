import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { focusWalkKey } from '../../platform-keys';
import { clickInPlace } from '../../click-in-place';
import { blockView, capturedErrors, tocEntry } from './helpers';
import { FootnotePage } from './footnotes-helpers';

// Every reading-mode jump, then Tab and Shift+Tab (requirements/plugins/reading-jump-focus.md):
// focus lands on the jump's target, no caret is left behind, and sequential focus continues from
// that target on every engine.

// A capped viewport keeps the far blocks unmounted, so each jump has to mount its target.
test.use({ viewport: { width: 1000, height: 700 } });

const FILLER = 120;

/** `[[toc]]`, the citing blocks, filler, a far heading, then the definitions. */
function jumpDoc() {
	const parts = [
		'[[toc]]',
		'Lead paragraph.',
		// A link and another reference come before `[^a]`, so a back-jump that landed on the block
		// rather than the reference would put Tab somewhere else.
		'See [a link](https://example.com), [^b] and then [^a] here.',
		'Between the citations.',
		'| Cell |\n| --- |\n| Cites [^c] |',
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
	/** A key whose half of the row waits on a known defect, and why. */
	fixme?: { key: 'Tab' | 'Shift+Tab'; reason: string };
}

const ROUTES: Route[] = [
	...(['Enter', 'click'] as const).map((how) => ({
		name: `reference to definition (${how})`,
		jump: (editor: JumpPage) => editor.jumpToDefA(how),
		lands: `block [${defA},0]`,
		tab: `marker in [${defA},0]`,
		shiftTab: `block [${defA - 1}]`
	})),
	...(['Enter', 'click'] as const).map((how) => ({
		name: `marker back to its reference (${how})`,
		jump: async (editor: JumpPage) => {
			await editor.jumpToDefA('Enter');
			await editor.followMarker(defA, how, 2);
		},
		lands: 'ref 2 in [2]',
		tab: 'block [3]',
		shiftTab: 'ref 1 in [2]'
	})),
	{
		name: 'marker back to a reference in a table cell',
		jump: async (editor: JumpPage) => {
			await editor.jumpToDefC();
			await editor.followMarker(defC, 'Enter', 4);
		},
		lands: 'ref 3 in [4]',
		tab: 'block [5]',
		shiftTab: 'block [4]',
		fixme: {
			key: 'Tab',
			reason: 'reading mode runs Tab in a table cell as cell navigation, and the last cell keeps it'
		}
	},
	...(['Enter', 'click'] as const).map((how) => ({
		name: `table of contents entry to its heading (${how})`,
		jump: (editor: JumpPage) => editor.followTocEntry(how),
		lands: `block [${heading}]`,
		tab: `block [${heading + 1}]`,
		shiftTab: `block [${heading - 1}]`
	}))
];

test.describe('reading mode: a jump lands focus where Tab continues', () => {
	for (const route of ROUTES) {
		for (const key of ['Tab', 'Shift+Tab'] as const) {
			test(`${route.name}, then ${key}`, async ({ page }) => {
				test.fixme(route.fixme?.key === key, route.fixme?.reason ?? '');
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
});
