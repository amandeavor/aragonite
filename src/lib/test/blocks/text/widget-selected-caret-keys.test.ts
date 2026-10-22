// @vitest-environment jsdom
// A selected widget leaves vertical arrows, Home, End and the page keys, with Shift too, to the
// shared caret move.
// Miss-analysis: key cases were chords or edit keys, and e2e never stepped from a selected image.
import { describe, it, expect } from 'vitest';
import { harness } from './widget-selected-fixture';

function press(key: string, shiftKey = false): KeyboardEvent {
	return new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
}

// The widget spans [0, 7); the tail keeps the paragraph from being image-only.
function selectedImage() {
	const carets: number[] = [];
	const h = harness('![a](x) tail\n', 0, undefined, {
		cursor: { setRaw: (offset: number) => carets.push(offset) } as never
	});
	return { ...h, carets };
}

describe('handleSelectedWidgetKeydown: a plain caret-moving key leaves the widget', () => {
	it.each([
		['ArrowUp', 0],
		['Home', 0],
		['PageUp', 0],
		['ArrowDown', 7],
		['End', 7],
		['PageDown', 7]
	])('%s puts the caret at offset %i, clears the selection and declines', async (key, edge) => {
		const { interaction, selection, carets } = selectedImage();
		const e = press(key);
		expect(await interaction.handleSelectedWidgetKeydown(e)).toBe(false);
		expect(carets).toEqual([edge]);
		expect(selection.widget).toBeNull();
		// The shared move runs next, from that caret, and owns the default.
		expect(e.defaultPrevented).toBe(false);
	});

	it.each([
		['ArrowDown', [0, 7]],
		['PageUp', [7, 0]]
	])(
		'Shift+%s selects the widget from its far edge, clears the selection and declines',
		async (key, range) => {
			const ranges: number[][] = [];
			const el = document.createElement('div');
			const h = harness('![a](x) tail\n', 0, undefined, {
				getEl: () => el,
				caretWriter: {
					selectRawRange: (_: HTMLElement, anchor: number, focus: number) =>
						ranges.push([anchor, focus])
				} as never
			});
			const e = press(key, true);
			expect(await h.interaction.handleSelectedWidgetKeydown(e)).toBe(false);
			expect(ranges).toEqual([range]);
			expect(h.selection.widget).toBeNull();
			expect(e.defaultPrevented).toBe(false);
		}
	);
});
