// Decoration sources an e2e spec installs through `window.__test.decorations`.
import type { Page } from '@playwright/test';

/** A replace decoration over `[start, end)` of the block at `path`, at a fixed offset whatever the
 *  block's marker shape, declined once the block lacks the bytes, since a source is a pure function. */
export async function addReplaceIsland(page: Page, path: number[], start: number, end: number) {
	await page.evaluate(
		({ path, start, end }) => {
			(window as any).__test.decorations.addSource({
				name: 'e2e-replace-island',
				provide: (doc: any) => {
					let node: any = doc;
					for (const index of path) node = node?.children?.[index];
					const held = node ? String(node.raw).replace(/\r?\n$/, '').length : 0;
					return held >= end ? [{ type: 'replace', path, start, end, class: 'e2e-island' }] : [];
				}
			});
		},
		{ path, start, end }
	);
}
