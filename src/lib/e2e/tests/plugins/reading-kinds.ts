/**
 * The reading-mode keyboard specs' shared document and reads: one block of every leaf kind,
 * loaded in reading mode, and what a focus walk from the focused element visits.
 */
import type { Page } from '@playwright/test';
import { focusWalkKey } from '../../platform-keys';
import { FootnotePage } from './footnotes-helpers';
import { settleDiagrams } from './mermaid-helpers';
import { focusName } from '../../reading-focus-probes';

export const KINDS_DOC = [
	'Intro with [a link](https://example.com/a).',
	'## A heading',
	'A plain paragraph.',
	'- item one\n- item two',
	'> a quoted line',
	'```js\nlet x = 1;\n```',
	'| H1 | H2 |\n| --- | --- |\n| a | bee |',
	'---',
	'<details>\n<summary>More here</summary>\n\nHidden body.\n\n</details>',
	':::tip Pro tip\nA tip.\n:::',
	'```mermaid\ngraph TD\n\tA --> B\n```',
	'Cites [^a] in passing.',
	'Outro with [b link](https://example.com/b).',
	'[^a]: The note text.'
].join('\n\n');

/** Loads {@link KINDS_DOC} in reading mode once its diagram has drawn, so a point measured on a
 *  block below it is still on that block when the click lands. */
export async function loadKinds(page: Page): Promise<FootnotePage> {
	const editor = new FootnotePage(page);
	await editor.load(KINDS_DOC, 'reading');
	await settleDiagrams(page);
	return editor;
}

export const block = (page: Page, path: number[]) =>
	page.locator(`[data-block-path="${JSON.stringify(path)}"]`);

/** Every element of the editor a focus walk from the focused element should reach, in order. */
export function controlsFrom(page: Page, backward: boolean, links: boolean): Promise<string[]> {
	return page.evaluate(
		({ backward, links }) => {
			const start = document.activeElement!;
			const stops = [...document.querySelectorAll<HTMLElement>('.editor *')].filter((el) => {
				if (el.tabIndex < 0 || el.getClientRects().length === 0) return false;
				if (!links && el.matches('a[href]:not([tabindex])')) return false;
				const at = start.compareDocumentPosition(el);
				return backward
					? !!(at & Node.DOCUMENT_POSITION_PRECEDING) && !(at & Node.DOCUMENT_POSITION_CONTAINS)
					: !!(at & Node.DOCUMENT_POSITION_FOLLOWING);
			});
			const names = stops.map((el) => {
				const path = el.closest('[data-block-path]')?.getAttribute('data-block-path') ?? '?';
				return `${el.tagName.toLowerCase()}.${el.classList[0] ?? ''} ${path} "${el.textContent?.trim().slice(0, 12)}"`;
			});
			return backward ? names.reverse() : names;
		},
		{ backward, links }
	);
}

/** The editor's elements in the tab order that aren't controls: reading mode keeps exactly one. */
export function blockStops(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('.editor [tabindex]')]
			.filter((el) => el.tabIndex >= 0)
			.filter(
				(el) =>
					!el.matches('a[href], button, input, select, textarea, [role="link"], [role="button"]')
			)
			.map((el) => el.closest('[data-block-path]')?.getAttribute('data-block-path') ?? '?')
	);
}

/** Presses Tab (or Shift+Tab) until focus reaches the host's button on that side. */
export async function walkOut(page: Page, backward: boolean): Promise<string[]> {
	const out = backward ? 'host-before' : 'host-after';
	const visited: string[] = [];
	for (let i = 0; i < 40; i++) {
		await page.keyboard.press(focusWalkKey({ backward }));
		const name = await focusName(page);
		if (name === out) return visited;
		visited.push(name);
	}
	throw new Error(`the walk never left the editor: ${visited.join(' | ')}`);
}
