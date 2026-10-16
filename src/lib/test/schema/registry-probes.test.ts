import { describe, it, expect } from 'vitest';
import { declarePluginKind } from '../../schema/plugin-kind';
import { registerBlockKind, isBlockKindRegistered } from '../../schema/block-kind-descriptor';
import { registerBlockOpener, isBlockOpenerRegistered } from '../../schema/block-openers';
import { testClosure } from '#lib/test/support/closure.js';
import { testView } from '#lib/test/support/test-view.js';

describe('registration probes', () => {
	it('reports a built-in kind as registered and an unknown name as not', () => {
		expect(isBlockKindRegistered('paragraph')).toBe(true);
		expect(isBlockKindRegistered('nope')).toBe(false);
		expect(isBlockOpenerRegistered('nope')).toBe(false);
	});

	it('flips from false to true across a plugin kind registration', () => {
		expect(isBlockKindRegistered('probeKind')).toBe(false);
		registerBlockKind(declarePluginKind('probeKind'), {
			gapEdges: 'none',
			mergeRole: 'not-mergeable',
			editable: false,
			supportsInline: false,
			closure: testClosure,
			view: testView()
		});
		expect(isBlockKindRegistered('probeKind')).toBe(true);
	});

	it('flips from false to true across a plugin opener registration', () => {
		const kind = declarePluginKind('probeOpener');
		expect(isBlockOpenerRegistered('probeOpener')).toBe(false);
		registerBlockOpener(kind, { priority: 100, tryOpen: () => null, interruptsParagraph: false });
		expect(isBlockOpenerRegistered('probeOpener')).toBe(true);
	});
});
