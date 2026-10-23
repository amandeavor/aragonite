// A dev check that would do more with a DOM says so when a test file without jsdom reaches it,
// instead of passing with its DOM half skipped. Miss: `kit-report-vocabulary` ran the widget cell
// without a DOM and checked only that its status was a valid word, so a quiet `boundary` passed.
import { describe, expect, it } from 'vitest';
import { documentForCheck } from '@voithos-labs/aragonite/dev-checks';
import { takeDevWarns } from '../support/warn-gate';

describe('a dev check with no DOM to read reports that it did not run', () => {
	it('gets no document and a needs-dom warning naming the check', () => {
		expect(typeof document).toBe('undefined');
		expect(documentForCheck('the probe check')).toBeNull();
		const warns = takeDevWarns();
		expect(warns.map((w) => w.tag)).toEqual(['needs-dom']);
		expect(warns[0].message).toContain('the probe check');
	});
});
