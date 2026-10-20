import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createTextBatch,
	endTypingBatchesForTests,
	holdTypingPausesForTests,
	openTypingBatchCountForTests,
	UNDO_DEBOUNCE_MS
} from '#lib/editor-actions/commit/text-batch.js';

// The suite runs in a dev build, so the one production row turns dev checks off here.
const env = vi.hoisted(() => ({ devChecks: true }));
vi.mock('#lib/env.js', () => ({ isDevChecks: () => env.devChecks }));

function harness() {
	const pushSnapshot = vi.fn();
	const onEnd = vi.fn();
	const batch = createTextBatch({ pushSnapshot, onEnd });
	return { batch, pushSnapshot, onEnd };
}

describe('text-batch lifecycle', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('first keystroke pushes a snapshot; the rest of the burst does not', () => {
		const { batch, pushSnapshot } = harness();
		batch.keystroke([2], 5);
		batch.keystroke([2], 6);
		batch.keystroke([2], 7);
		expect(pushSnapshot).toHaveBeenCalledTimes(1);
		expect(pushSnapshot).toHaveBeenCalledWith([2], 5);
	});

	it('a pause ends the batch, so the next keystroke re-snapshots', () => {
		const { batch, pushSnapshot, onEnd } = harness();
		batch.keystroke([1], 0);
		batch.armPause();
		batch.keystroke([1], 1);
		batch.armPause();
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS - 1);
		batch.keystroke([1], 2);
		expect(pushSnapshot).toHaveBeenCalledTimes(1);

		batch.armPause();
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS);
		expect(onEnd).toHaveBeenCalledTimes(1);
		batch.keystroke([1], 3);
		expect(pushSnapshot).toHaveBeenCalledTimes(2);
	});

	// Miss-analysis (GH #71): every case started the pause timer inside a fast `keystroke`.
	it('the window opens at the branch, not at the keystroke: a slow settle spends no budget', () => {
		const { batch, pushSnapshot } = harness();
		batch.keystroke([1], 0);
		// The keystroke's own processing, longer than the whole window.
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS * 2);
		batch.armPause();
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS - 1);

		batch.keystroke([1], 1);
		expect(pushSnapshot, 'the burst stayed one batch').toHaveBeenCalledTimes(1);
	});

	it('arming with no live batch starts no window', () => {
		const { batch } = harness();
		batch.armPause();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('a batch-key change starts a new batch', () => {
		const { batch, pushSnapshot } = harness();
		batch.keystroke([0, 0], 0, 'leaf-a');
		batch.keystroke([0, 0], 1, 'leaf-a');
		batch.keystroke([0, 1], 0, 'leaf-b');
		expect(pushSnapshot).toHaveBeenCalledTimes(2);
		expect(pushSnapshot).toHaveBeenLastCalledWith([0, 1], 0);
	});

	it('path fallback key: a different leaf path starts a new batch', () => {
		const { batch, pushSnapshot } = harness();
		batch.keystroke([0], 0);
		batch.keystroke([1], 0);
		expect(pushSnapshot).toHaveBeenCalledTimes(2);
	});

	it('interrupt cancels the pause timer and forces a fresh snapshot', () => {
		const { batch, pushSnapshot, onEnd } = harness();
		batch.keystroke([3], 4);
		batch.armPause();
		batch.interrupt();
		expect(vi.getTimerCount()).toBe(0);
		expect(onEnd).toHaveBeenCalledTimes(1);
		batch.keystroke([3], 5);
		expect(pushSnapshot).toHaveBeenCalledTimes(2);
	});
});

describe('text-batch test control', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		endTypingBatchesForTests();
	});
	afterEach(() => {
		env.devChecks = true;
		holdTypingPausesForTests(false);
		vi.useRealTimers();
	});

	it('a held batch outlasts any pause, and the end closes every open batch', () => {
		holdTypingPausesForTests(true);
		const one = harness();
		const two = harness();
		one.batch.keystroke([0], 0);
		one.batch.armPause();
		two.batch.keystroke([1], 0);
		two.batch.armPause();
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS * 10);
		one.batch.keystroke([0], 1);
		expect(one.pushSnapshot).toHaveBeenCalledTimes(1);
		expect(openTypingBatchCountForTests()).toBe(2);

		endTypingBatchesForTests();
		expect(one.onEnd).toHaveBeenCalledTimes(1);
		expect(two.onEnd).toHaveBeenCalledTimes(1);
		expect(openTypingBatchCountForTests()).toBe(0);
		one.batch.keystroke([0], 2);
		expect(one.pushSnapshot).toHaveBeenCalledTimes(2);
	});

	it('an end with no batch open ends nothing', () => {
		const { batch, onEnd } = harness();
		batch.keystroke([0], 0);
		batch.interrupt();
		endTypingBatchesForTests();
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it('releasing the hold ends what it kept open, and the timer runs again', () => {
		holdTypingPausesForTests(true);
		const { batch, pushSnapshot, onEnd } = harness();
		batch.keystroke([0], 0);
		batch.armPause();
		holdTypingPausesForTests(false);
		expect(onEnd).toHaveBeenCalledTimes(1);

		batch.keystroke([0], 1);
		batch.armPause();
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS);
		expect(onEnd).toHaveBeenCalledTimes(2);
		expect(openTypingBatchCountForTests()).toBe(0);
		batch.keystroke([0], 2);
		expect(pushSnapshot).toHaveBeenCalledTimes(3);
	});

	it('outside dev checks the hold is refused and the pause still ends a batch', () => {
		env.devChecks = false;
		expect(holdTypingPausesForTests(true)).toBe(false);
		const { batch, onEnd } = harness();
		batch.keystroke([0], 0);
		batch.armPause();
		expect(openTypingBatchCountForTests()).toBe(0);
		vi.advanceTimersByTime(UNDO_DEBOUNCE_MS);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});
});
