import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { PluginsPage } from '../plugins/helpers';

/**
 * A widget selected whole wears the selection wash, whatever its shape and whatever block holds it,
 * so the key that replaces it never replaces something the user couldn't see was selected. The
 * scenarios are in e2e/requirements/selection/widget-selected-paint.md.
 */

interface Host {
	name: string;
	/** The document, with `W` where the widget goes. */
	doc: string;
	path: number[];
	cell?: true;
}

const HOSTS: Host[] = [
	{ name: 'a paragraph', doc: 'ab W cd\n', path: [0] },
	{ name: 'a heading', doc: '# ab W cd\n', path: [0] },
	{ name: 'a list item', doc: '- ab W cd\n', path: [0, 0, 0] },
	{ name: 'a quote child', doc: '> ab W cd\n', path: [0, 0] },
	{
		name: 'a table cell',
		doc: '| a | b |\n| - | - |\n| ab W cd | z |\n',
		path: [0, 1, 0],
		cell: true
	}
];

interface Shape {
	name: string;
	source: string;
	/** Selects the widget whole with the caret at its start, the way a user does. */
	select: (page: Page) => Promise<void>;
	/** A cell steps over a `<br>` and draws an image as its source, so neither is selected there. */
	inCells: boolean;
}

const SHAPES: Shape[] = [
	{
		name: 'a live `<br>`',
		source: '<br>',
		select: (page) => page.keyboard.press('ArrowRight'),
		inCells: false
	},
	{
		name: 'a chip',
		source: '{{alpha}}',
		select: (page) => page.keyboard.press('ControlOrMeta+k'),
		inCells: true
	}
];

async function rawOf(page: Page, path: number[]): Promise<string> {
	return page.evaluate((p) => {
		let node = (window as any).__test.getDocument();
		for (const i of p) node = node.children[i];
		return String(node.raw);
	}, path);
}

/** The selected widget's start and the box its wash paints, against the line the widget sits on. */
async function readWash(page: Page) {
	return page.evaluate(() => {
		const selected = document.querySelectorAll<HTMLElement>(
			'[data-inline-widget].md-widget-selected'
		);
		if (selected.length !== 1) return { count: selected.length };
		const widget = selected[0];
		// A line break paints its wash before the `<br>`, so it sits on the line the break ends.
		const painted = ['::after', '::before'].map((name) => getComputedStyle(widget, name));
		const pseudo = painted.find((style) => style.content !== 'none') ?? painted[0];
		const probe = document.createElement('div');
		document.querySelector('.editor')!.appendChild(probe);
		probe.style.backgroundColor = 'var(--selection-overlay-bg)';
		const wash = getComputedStyle(probe).backgroundColor;
		probe.remove();
		const line = parseFloat(getComputedStyle(widget.parentElement!).lineHeight);
		return {
			count: 1,
			start: Number(widget.dataset.sourceStart),
			content: pseudo.content,
			width: parseFloat(pseudo.width),
			height: parseFloat(pseudo.height),
			line,
			background: pseudo.backgroundColor,
			wash
		};
	});
}

test.describe('a widget selected whole shows that it is', () => {
	let editor: PluginsPage;

	test.beforeEach(async ({ page }) => {
		editor = new PluginsPage(page);
		await editor.gotoPlugins('chips');
		await editor.waitForRenderFlush();
	});

	async function selectIn(shape: Shape, host: Host): Promise<number> {
		await editor.loadContent(host.doc.replace('W', shape.source));
		const start = (await rawOf(editor.page, host.path)).indexOf(shape.source);
		await editor.page.evaluate(
			([p, offset]) => (window as any).__test.focusBlockComponent(p, offset),
			[host.path, shape.source === '<br>' ? start : start + shape.source.length] as const
		);
		await shape.select(editor.page);
		await editor.waitForRenderFlush();
		return start;
	}

	for (const shape of SHAPES) {
		for (const host of HOSTS) {
			if (host.cell && !shape.inCells) continue;
			test(`${shape.name} in ${host.name} wears the selection wash over one line`, async ({
				page
			}) => {
				const start = await selectIn(shape, host);
				const wash = await readWash(page);

				expect(wash).toMatchObject({ count: 1, start });
				if (wash.count !== 1) return;
				expect(wash.content).not.toBe('none');
				expect(wash.background).toBe(wash.wash);
				// A zero-width box paints nothing, and one taller than a line covers the next line too.
				expect(wash.width).toBeGreaterThanOrEqual(4);
				expect(wash.height).toBeGreaterThan(0);
				expect(wash.height).toBeLessThanOrEqual(wash.line! * 1.25);
			});
		}

		test(`${shape.name}, washed, is replaced by the next typed letter`, async ({ page }) => {
			await selectIn(shape, HOSTS[0]);
			await expect.poll(async () => (await readWash(page)).count).toBe(1);

			await page.keyboard.type('X');
			await expect.poll(() => editor.bridge.getSource()).toBe('ab X cd\n');
		});
	}

	test('an image clicked in reading mode, where it has no ring, wears the wash', async ({
		page
	}) => {
		await editor.loadContent('lead ![pic](/test-fixtures/sample.png) trail\n');
		await editor.setPresentationMode('reading');
		await editor.waitForRenderFlush();
		await page.locator('[data-image-widget]').first().click();
		await editor.waitForRenderFlush();

		await expect(page.locator('[data-image-overlay]')).toHaveCount(0);
		const wash = await readWash(page);
		expect(wash).toMatchObject({ count: 1, start: 5 });
		expect(wash.background).toBe(wash.wash);
	});
});
