import { describe, expect, it } from 'vitest';
import { declarePluginKind } from '#lib/schema/plugin-kind.js';
import { registerBlockCommand, getBlockCommand } from '#lib/schema/block-commands.js';
import type { AnyCommandId } from '#lib/schema/command-id.js';
import { registerInlineSyntax, type InlineSyntaxRecognizer } from '#lib/plugin.js';
import { everyInstalledPlugin } from '#lib/schema/plugin-activation.js';

const recognizer = (): InlineSyntaxRecognizer => () => null;

// registry-conflict.test.ts covers the block registries; this suite covers inline syntax and kind
// declaring.
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
