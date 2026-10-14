/**
 * The editor's own reset in editor.css sets everything the demo app's global reset in app.css
 * sets (G4.184). Every e2e route but one loads app.css, so a declaration only app.css carried
 * would pass nearly every suite and still move editor boxes on a host page without it.
 * Miss-analysis: every harness route loaded app.css, so no test ever saw an editor without a reset.
 */
import { describe, it, expect } from 'vitest';
import { readSource } from './scan-source';
import { SOURCE } from './source-paths';

const RULE = /([^{}]+)\{([^{}]*)\}/g;

/** The declarations of the first rule in `css` whose selector `isReset` accepts. */
function resetDeclarations(css: string, isReset: (selector: string) => boolean): string[] {
	const rule = [...css.matchAll(RULE)].find(([, selector]) => isReset(selector));
	if (!rule) return [];
	return rule[2]
		.split(';')
		.map((declaration) => declaration.trim().replace(/\s+/g, ' '))
		.filter(Boolean);
}

describe('G4.184 the editor carries the reset the demo app applies to every page', () => {
	const app = resetDeclarations(readSource(SOURCE.appCss).code, (selector) =>
		/^\s*\*\s*,/.test(selector)
	);
	const editor = resetDeclarations(readSource(SOURCE.editorCss).code, (selector) =>
		selector.includes('[data-host-content]')
	);

	it('finds both resets', () => {
		expect(app.length).toBeGreaterThan(0);
		expect(editor.length).toBeGreaterThan(0);
	});

	it('every declaration of the app reset is in the editor reset', () => {
		expect(
			app.filter((declaration) => !editor.includes(declaration)),
			'add these to the reset at the top of editor.css, or the tests stop showing what a host without the app reset sees'
		).toEqual([]);
	});
});
