import { describe, expect, it } from 'vitest';
import { configureEditorEnv } from '#lib/env.js';
import { takeDevWarns } from '../support/warn-gate';
import { declarePluginKind } from '#lib/schema/plugin-kind.js';
import {
	blockViewFor,
	registerBlockKind,
	getBlockKindDescriptor
} from '#lib/schema/block-kind-descriptor.js';
import { asBlockView } from '#lib/schema/block-view.js';
import { getOrderedOpeners, type BlockOpener } from '#lib/schema/block-openers.js';
import { registerBlockCommand, getBlockCommand } from '#lib/schema/block-commands.js';
import type { AnyCommandId } from '#lib/schema/command-id.js';
import {
	registerInlineSyntax,
	getInlineRungs,
	type InlineSyntaxRecognizer
} from '#lib/core/inline/scan/plugin-syntax.js';
import { testClosure } from '#lib/test/support/closure.js';
import { everyInstalledPlugin } from '#lib/schema/plugin-activation.js';

const stubView = (tag: string) => asBlockView({ tag });
const registration = (editable: boolean, view = stubView('view')) =>
	({
		mergeRole: 'not-mergeable',
		editable,
		supportsInline: false,
		gapEdges: 'none',
		closure: testClosure,
		view
	}) as const;

const stubOpener = (priority: number): BlockOpener => ({
	priority,
	tryOpen: () => null,
	interruptsParagraph: false
});
const recognizer = (): InlineSyntaxRecognizer => () => null;

// The registries that soften on a dev server must still throw under test. registry-conflict.test.ts
// covers the block registries; this suite covers inline syntax and kind declaring.
describe('register-once still throws on duplicate under test', () => {
	it('registerInlineSyntax throws on a duplicate trigger', () => {
		registerInlineSyntax('¬', recognizer());
		expect(() => registerInlineSyntax('¬', recognizer())).toThrow(/already registered/i);
	});

	it('declarePluginKind throws on a duplicate name', () => {
		declarePluginKind('dup-under-test');
		expect(() => declarePluginKind('dup-under-test')).toThrow(/already declared/i);
	});
});

// The name is validated inside apply, before the map is written, so a rejected name cannot leave
// a handler behind after a registration throws.
describe('registerBlockCommand validates the name before touching the registry', () => {
	it('an invalid name throws and leaves no orphaned handler', () => {
		expect(() => registerBlockCommand('paragraph', 'Invalid Name', () => false)).toThrow();
		expect(
			getBlockCommand('paragraph', 'Invalid Name' as AnyCommandId, everyInstalledPlugin)
		).toBeUndefined();
	});
});

// The dev-server exception: hot reload and SSR re-run a plugin's registerX calls against a
// registry that survived, and a throw there breaks the route.
describe('dev re-registration replaces instead of throwing', () => {
	function asDevNotTest() {
		configureEditorEnv({ isDev: true, isTest: false });
	}

	it('registerBlockKind replaces the descriptor and the view', () => {
		const kind = declarePluginKind('dev-kind');
		const second = stubView('second');
		registerBlockKind(kind, registration(true, stubView('first')));
		asDevNotTest();
		expect(() => registerBlockKind(kind, registration(false, second))).not.toThrow();
		expect(getBlockKindDescriptor(kind).editable).toBe(false);
		expect(blockViewFor(kind, everyInstalledPlugin)).toBe(second);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['registry']);
	});

	it('registerBlockKind replaces the opener and re-clears the ordered cache', () => {
		const kind = declarePluginKind('dev-opener');
		registerBlockKind(kind, { ...registration(true), opener: stubOpener(15) });
		// Prime the cache so the replace has to invalidate it, not just an empty read.
		expect(getOrderedOpeners().some((o) => o.priority === 15)).toBe(true);
		asDevNotTest();
		expect(() =>
			registerBlockKind(kind, { ...registration(true), opener: stubOpener(16) })
		).not.toThrow();
		expect(getOrderedOpeners().some((o) => o.priority === 16)).toBe(true);
		expect(getOrderedOpeners().some((o) => o.priority === 15)).toBe(false);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['registry']);
	});

	it('registerInlineSyntax replaces the recognizer', () => {
		const first = recognizer();
		const second = recognizer();
		registerInlineSyntax('¬', first);
		asDevNotTest();
		expect(() => registerInlineSyntax('¬', second)).not.toThrow();
		expect(getInlineRungs('¬')[0].recognizer).toBe(second);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['registry']);
	});

	it('declarePluginKind returns the existing brand on re-declaration', () => {
		const first = declarePluginKind('dev-declare');
		asDevNotTest();
		let second: string | undefined;
		expect(() => (second = declarePluginKind('dev-declare'))).not.toThrow();
		expect(second).toBe(first);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['registry']);
	});
});
