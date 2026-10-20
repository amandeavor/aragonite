import { describe, expect, it } from 'vitest';
import { checkMotionLeftWidget } from '../../invariants/selected-widget-motion';

describe('G1.128 a caret key a selected widget declines leaves the widget', () => {
	it('fails a caret key declined with the widget still selected', () => {
		expect(checkMotionLeftWidget('Home', true, true)?.code).toBe('selected-widget-motion');
	});

	it('passes a caret key that left the widget, and any other declined key', () => {
		expect(checkMotionLeftWidget('Home', true, false)).toBeNull();
		expect(checkMotionLeftWidget('z', false, true)).toBeNull();
	});
});
