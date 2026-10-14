// @vitest-environment jsdom
// A plugin view that throws, at mount, at update or at destroy, costs only itself: its slot draws
// the fallback (the source, no widget, no badge, the default row) and the editor's `error` event
// gets exactly one report.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs
} from '#lib/test/harness/mount-editor.svelte.js';
import { domProbe, stages, viewExploded, type LogEntry } from './fixtures/probe-view';
import { SLOTS } from './fixtures/view-slots';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

const reported = (errors: { error: unknown }[]) => errors.map((e) => e.error);

describe.each(SLOTS.map((slot) => [slot.name, slot] as const))('%s', (_name, slot) => {
	it('that throws while mounting draws the fallback and reports once', async () => {
		const run = await slot.run(domProbe([], 'mount'));
		expect(run.fellBack()).toBe(true);
		expect(reported(run.errors)).toEqual([viewExploded]);
		expect(takeDevWarns().map((warn) => warn.tag)).toEqual(slot.mountFailureWarns);
	});

	it('that throws on every mount is not mounted again as the slot redraws', async () => {
		let mounts = 0;
		const run = await slot.run(() => {
			mounts++;
			throw viewExploded;
		});
		const settled = { mounts, reports: run.errors.length };
		await run.update();
		await run.update();
		takeDevWarns();
		expect({ mounts, reports: run.errors.length }).toEqual(settled);
	});

	it('that throws while updating draws the fallback and reports once', async () => {
		const log: LogEntry[] = [];
		const run = await slot.run(domProbe(log, 'update'));
		expect(run.fellBack()).toBe(false);
		await run.update();
		expect(run.fellBack()).toBe(true);
		expect(reported(run.errors)).toEqual([viewExploded]);
		// The broken view is torn down with the failure, and its slot mounts no fresh one.
		const mounts = () => stages(log).filter((stage) => stage === 'mount').length;
		const mounted = mounts();
		await run.update();
		expect(mounts()).toBe(mounted);
		expect(reported(run.errors)).toEqual([viewExploded]);
		const after = log.length;
		await run.remove();
		expect(log.slice(after).filter((entry) => entry.stage !== 'destroy')).toEqual([]);
	});

	it('that throws while being destroyed is reported once', async () => {
		const run = await slot.run(domProbe([], 'destroy'));
		await run.remove();
		expect(reported(run.errors)).toEqual([viewExploded]);
	});

	it('whose destroy rejects is reported once per instance', async () => {
		let instances = 0;
		const run = await slot.run(() => {
			instances++;
			return { destroy: () => Promise.reject(viewExploded) };
		});
		await run.remove();
		await Promise.resolve();
		expect(reported(run.errors)).toEqual(Array(instances).fill(viewExploded));
	});
});
