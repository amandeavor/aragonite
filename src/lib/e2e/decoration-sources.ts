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

/** A widget decoration at `offset` of the block at `path`, standing for no bytes, declined once the
 *  block lacks the bytes, as the replace source is. */
export async function addWidgetIsland(page: Page, path: number[], offset: number) {
	await page.evaluate(
		({ path, offset }) => {
			(window as any).__test.decorations.addSource({
				name: 'e2e-widget-island',
				provide: (doc: any) => {
					let node: any = doc;
					for (const index of path) node = node?.children?.[index];
					const held = node ? String(node.raw).replace(/\r?\n$/, '').length : 0;
					if (held < offset) return [];
					return [
						{
							type: 'widget',
							path,
							offset,
							widget: {
								view: (target: HTMLElement) => {
									target.append(document.createElement('span'));
									return {};
								}
							}
						}
					];
				}
			});
		},
		{ path, offset }
	);
}
