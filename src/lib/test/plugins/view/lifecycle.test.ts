// @vitest-environment jsdom
// Every place the editor draws a plugin's view (an inline widget, a decoration widget, a block
// badge, a menu row) mounts it once, hands it new props through `update`, and destroys it once,
// whether the view is plain DOM or a Svelte component through its helper.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { Component } from 'svelte';
import type { PluginView } from '#lib/plugin-view.js';
import {
	svelteDecorationWidget,
	svelteInlineWidget,
	svelteMenuRow
} from '#lib/svelte-views.svelte.js';
import {
	destroyMountedEditors,
	installLayoutStubs
} from '#lib/test/harness/mount-editor.svelte.js';
import { domProbe, stages, svelteLog, type LogEntry } from './fixtures/probe-view';
import {
	badgeSlot,
	inlineWidgetSlot,
	islandSlot,
	menuRowSlot,
	type Slot
} from './fixtures/view-slots';
import SvelteProbe from './fixtures/SvelteProbe.svelte';

beforeAll(installLayoutStubs);
beforeEach(() => void (svelteLog.length = 0));
afterEach(destroyMountedEditors);

const probe = SvelteProbe as Component<never>;
const AUTHORED: [Slot<never>, (c: Component<never>) => PluginView<never>][] = [
	[inlineWidgetSlot as Slot<never>, svelteInlineWidget as never],
	[islandSlot as Slot<never>, svelteDecorationWidget as never],
	[badgeSlot as Slot<never>, svelteDecorationWidget as never],
	[menuRowSlot as Slot<never>, svelteMenuRow as never]
];

const count = (log: LogEntry[], stage: LogEntry['stage']) =>
	log.filter((entry) => entry.stage === stage).length;

describe.each(AUTHORED.map(([slot, helper]) => [slot.name, slot, helper] as const))(
	'%s',
	(_name, slot, helper) => {
		it('mounts a DOM view, updates it in place and destroys each instance once', async () => {
			const log: LogEntry[] = [];
			const run = await slot.run(domProbe(log));
			const drawn = run.drawn();
			expect(drawn).not.toBeNull();
			const mounts = count(log, 'mount');

			await run.update();
			expect(count(log, 'update')).toBeGreaterThan(0);
			expect(count(log, 'mount')).toBe(mounts);
			expect(run.drawn()).toBe(drawn);

			await run.remove();
			expect(run.drawn()).toBeNull();
			expect(count(log, 'destroy')).toBe(mounts);
			expect(run.errors).toEqual([]);
		});

		it('mounts a Svelte view through its helper, re-renders it on update, unmounts it', async () => {
			const run = await slot.run(helper(probe));
			const drawn = run.drawn();
			expect(drawn).not.toBeNull();
			const mounts = count(svelteLog, 'mount');
			const renders = count(svelteLog, 'render');

			await run.update();
			expect(count(svelteLog, 'render')).toBeGreaterThan(renders);
			expect(count(svelteLog, 'mount')).toBe(mounts);
			expect(run.drawn()).toBe(drawn);

			await run.remove();
			expect(count(svelteLog, 'destroy')).toBe(mounts);
			expect(run.errors).toEqual([]);
		});
	}
);

describe('the props an update carries', () => {
	it('moves a pooled inline widget to where typing put it', async () => {
		const log: LogEntry[] = [];
		const run = await inlineWidgetSlot.run(domProbe(log));
		await run.update();
		const moved = log.find((entry) => entry.stage === 'update')?.props as {
			inline: { start: number };
		};
		expect(moved.inline.start).toBe(3);
	});

	it('hands a menu row its new active flag', async () => {
		const log: LogEntry[] = [];
		const run = await menuRowSlot.run(domProbe(log));
		await run.update();
		const flags = log
			.filter((entry) => entry.stage === 'update')
			.map((entry) => (entry.props as { item: { id: string }; active: boolean }).item.id);
		expect(flags.sort()).toEqual(['a', 'b']);
		expect(stages(log).filter((stage) => stage === 'mount')).toHaveLength(2);
	});
});
