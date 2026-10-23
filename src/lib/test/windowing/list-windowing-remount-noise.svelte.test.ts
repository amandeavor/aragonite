// @vitest-environment jsdom
// Miss-analysis: the sub-pixel noise rule was tested only on the resize route, so the mount route,
// which re-reads a block remounting at a fractionally different height, was never run against it.
import { describe, it, expect } from 'vitest';
import { tick } from 'svelte';
import type { HeightOracle } from '../../windowing/height-estimator';
import { makePara, mountListWindowing } from '../harness/list-windowing.svelte';

const ESTIMATE = 100;
const FIRST = 31.421875;

function recordingOracle(measured: Record<string, number>): HeightOracle & { recorded: number[] } {
	const recorded: number[] = [];
	return {
		recorded,
		estimate: () => ESTIMATE,
		measured: (id) => measured[id],
		recordMeasured: (_id, h) => void recorded.push(h)
	};
}

async function remountAt(readHeight: number, measured: Record<string, number>) {
	const oracle = recordingOracle(measured);
	const scope = mountListWindowing({
		children: [makePara('p0\n'), makePara('p1\n'), makePara('p2\n')],
		ids: ['b0', 'b1', 'b2'],
		oracle,
		listHeight: 3 * ESTIMATE
	});
	scope.windowing.registerChild('b1', { index: 1, readHeight: () => readHeight });
	await tick();
	const slotHeight = scope.windowing.targetTopOf(1)?.height;
	scope.cleanup();
	return { recorded: oracle.recorded, slotHeight };
}

describe('a block remounting within a pixel of its recorded height keeps that height', () => {
	it('sub-pixel layout noise on a remount moves neither the table nor the record', async () => {
		const { recorded, slotHeight } = await remountAt(31.359375, { b1: FIRST });
		expect(slotHeight).toBe(FIRST);
		expect(recorded.every((h) => h === FIRST)).toBe(true);
	});

	it('a remount a pixel or more off its record is a real change', async () => {
		const { slotHeight } = await remountAt(FIRST + 1, { b1: FIRST });
		expect(slotHeight).toBe(FIRST + 1);
	});

	it('a first measure replaces the estimate exactly, however close', async () => {
		const { slotHeight } = await remountAt(ESTIMATE - 0.25, {});
		expect(slotHeight).toBe(ESTIMATE - 0.25);
	});
});
