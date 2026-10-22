// G1.115: a restored caret that moved off its byte must have met a widget with no source to show.
import { describe, it, expect } from 'vitest';
import { checkWidgetCaretLanding, type LandingWidget } from '../../invariants/widget-caret-landing';

const TAG: LandingWidget = { start: 0, end: 4, kind: 'tag', showsSource: true };
const EMOJI: LandingWidget = { start: 5, end: 12, kind: 'emoji', showsSource: false };

describe('G1.115 a caret restored inside a widget that can show its source stays at its byte', () => {
	it('names the widget a caret was pushed out of', () => {
		const violation = checkWidgetCaretLanding(1, 4, [TAG, EMOJI]);
		expect(violation?.code).toBe('widget-caret-landing');
		expect(violation?.detail).toMatchObject({ requested: 1, landed: 4, widget: TAG });
	});

	it('passes a caret that landed where it was asked, or that no focus could read back', () => {
		expect(checkWidgetCaretLanding(1, 1, [TAG])).toBeNull();
		expect(checkWidgetCaretLanding(1, null, [TAG])).toBeNull();
	});

	it('passes a widget with no source to show, and a caret at a widget edge', () => {
		expect(checkWidgetCaretLanding(6, 12, [TAG, EMOJI])).toBeNull();
		expect(checkWidgetCaretLanding(4, 5, [TAG])).toBeNull();
		expect(checkWidgetCaretLanding(0, 1, [TAG])).toBeNull();
	});
});
