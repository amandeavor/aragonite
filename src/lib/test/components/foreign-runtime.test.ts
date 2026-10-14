// @vitest-environment jsdom
// A plugin component compiled against another copy of Svelte fails as soon as the editor mounts it.
// Every route that mounts one says so in dev, instead of a generic failure that hides the cause.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type { Component } from 'svelte';
import { parse } from '#lib/core/parser.js';
import { createEditorEvents } from '#lib/editor-events.js';
import {
	registerBlockComponent,
	defineBlockComponent
} from '#lib/schema/block-component-registry.js';
import { mountDecorationWidget } from '#lib/decorations/widget-dom.js';
import type { BlockDecoration } from '#lib/decorations/types.js';
import { createSvelteWidgetPool } from '#lib/components/blocks/widget-portal.js';
import { registerInlineWidgetKind } from '#lib/core/inline/inline-widgets.js';
import { declarePluginInlineKind } from '#lib/schema/plugin-kind.js';
import { bindActivationClick, createPressTracker } from '#lib/activation-click.js';
import { isForeignRuntimeError } from '#lib/foreign-runtime.js';
import { installEditorDomStubsForTests } from '#lib/testing.js';
import { testLeaf } from '#lib/test/harness/test-kinds.js';
import { fixtureReading } from '#lib/test/harness/fixture-grammar.js';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';
import ThrowingBlock from './fixtures/ThrowingBlock.svelte';
import { mountBlockHost, type MountedHost } from './mount-host';

const CAUSE = 'compiled against a different Svelte runtime';

const FIXTURES = {
	'template only': () => import('./fixtures/ForeignTemplate.svelte'),
	'its own $effect': () => import('./fixtures/ForeignEffect.svelte')
};

/** A fresh copy of the fixture on a fresh copy of the Svelte runtime, never mounted before. */
async function loadForeign(name: keyof typeof FIXTURES): Promise<Component> {
	vi.resetModules();
	return (await FIXTURES[name]()).default;
}

beforeAll(installEditorDomStubsForTests);

let mounted: MountedHost | null = null;
afterEach(async () => {
	if (mounted) await mounted.dispose();
	mounted = null;
});

function mountBlock(component: Component<never>, raw = 'hello\n'): HTMLElement {
	const doc = parse(raw);
	const kind = testLeaf('foreign-runtime');
	registerBlockComponent(kind, defineBlockComponent(component as never));
	doc.children[0].kind = kind;
	mounted = mountBlockHost(
		doc,
		{ node: doc.children[0] },
		{ services: { events: createEditorEvents() } }
	);
	return mounted.el;
}

function acquireInlineWidget(component: Component): HTMLElement | null {
	const kind = declarePluginInlineKind('foreignRuntimeWidget');
	registerInlineWidgetKind(kind, { isWidget: () => true, component: component as never });
	const reading = fixtureReading();
	const pool = createSvelteWidgetPool({
		reportError: () => {},
		getTheme: () => 'light',
		getDocument: () => undefined,
		getContentVersion: () => 0,
		navigateTo: async () => false,
		reading,
		activationClick: bindActivationClick(reading.mode, () => 'plain', createPressTracker())
	});
	pool.beginPass();
	const wrapper = pool.acquire(kind as never, { kind, start: 0, end: 2 } as never, '%%');
	pool.sweep();
	pool.dispose();
	return wrapper;
}

const warnTags = () => takeDevWarns().map((record) => record.tag);

describe.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
	'a component on a second runtime (%s)',
	(name) => {
		it('fails its block with a notice naming the cause', async () => {
			const el = mountBlock(await loadForeign(name));
			const notice = el.querySelector('[data-failed-block] .failed-block-notice');
			expect(notice?.textContent).toContain(CAUSE);
			expect(warnTags()).toEqual(['foreign-runtime']);
		});

		it('as an inline widget, falls back to its source and warns with the cause', async () => {
			expect(acquireInlineWidget(await loadForeign(name))).toBeNull();
			expect(warnTags()).toEqual(['foreign-runtime']);
		});

		it('as a decoration widget, is left out and warns with the cause', async () => {
			const dec: BlockDecoration = { type: 'block', path: [0] };
			expect(
				mountDecorationWidget({ component: (await loadForeign(name)) as never }, dec)
			).toBeNull();
			expect(warnTags()).toEqual(['foreign-runtime']);
		});
	}
);

it('a template-only component fails a later mount differently, and that names the cause too', async () => {
	const component = await loadForeign('template only');
	expect(acquireInlineWidget(component)).toBeNull();
	takeDevWarns();
	const el = mountBlock(component);
	expect(el.querySelector('.failed-block-notice')?.textContent).toContain(CAUSE);
	expect(warnTags()).toEqual(['foreign-runtime']);
});

it('a block that throws for its own reasons keeps the plain notice', () => {
	const el = mountBlock(ThrowingBlock, 'boom\n');
	const notice = el.querySelector('[data-failed-block] .failed-block-notice');
	expect(notice?.textContent).toBe('⚠ block failed to render');
	expect(warnTags()).toEqual([]);
});

// Only V8 runs here, so the other engines' wording of both crashes is pinned by hand.
describe('isForeignRuntimeError', () => {
	it.each([
		['V8', "Cannot read properties of undefined (reading 'call')"],
		['SpiderMonkey', 'can\'t access property "call", first_child_getter is undefined'],
		['JavaScriptCore', "undefined is not an object (evaluating 'first_child_getter.call')"],
		['V8, a later mount', "Cannot read properties of null (reading 'nodes')"],
		['SpiderMonkey, a later mount', `can't access property "nodes", effect is null`],
		['JavaScriptCore, a later mount', "null is not an object (evaluating 'effect.nodes')"]
	])('reads the %s message', (_, message) => {
		expect(isForeignRuntimeError(new TypeError(message))).toBe(true);
	});

	it('reads a production build of the runtime naming effect_orphan only by its link', () => {
		expect(isForeignRuntimeError(new Error('https://svelte.dev/e/effect_orphan'))).toBe(true);
	});

	it.each([
		[
			'another undefined read',
			new TypeError("Cannot read properties of undefined (reading 'raw')")
		],
		['a plain error mentioning call', new Error('could not call the renderer')],
		['a thrown string', 'effect_orphan']
	])('ignores %s', (_, error) => {
		expect(isForeignRuntimeError(error)).toBe(false);
	});
});
