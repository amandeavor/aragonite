/**
 * Every hover control pinned to a block's top-right corner carries `data-corner-control` (G4.180),
 * so the open find bar moves it when it covers it. The scan finds such a control by its style:
 * absolute, placed by `top` and `right`, and hidden at rest with `opacity: 0`.
 * Miss-analysis: the bar's rule named the code block's controls, and the diagram and equation
 * controls in the same corner went under the bar unnoticed.
 */
import { describe, it, expect } from 'vitest';
import { collectEditorSources } from './scan-source';
import { CORNER_CONTROL_ATTR } from '#lib/components/corner-controls.js';

/** The selectors of the rules in `css` that style a hidden-at-rest top-right corner control. */
function cornerControlRules(css: string): string[] {
	const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
	return rules
		.filter(([, , body]) => {
			const has = (pattern: RegExp) => pattern.test(body);
			return (
				has(/(?:^|[;\s])position:\s*absolute\b/) &&
				has(/(?:^|[;\s])top:/) &&
				has(/(?:^|[;\s])right:/) &&
				has(/(?:^|[;\s])opacity:\s*0\s*(?:;|$)/)
			);
		})
		.map(([, selector]) => selector.trim());
}

const HITS = [
	'.code-rail {\n\tposition: absolute;\n\ttop: 12px;\n\tright: 8px;\n\topacity: 0;\n}',
	'.toolbar { right: 6px; position: absolute; opacity: 0; top: 6px }'
];

const MISSES = [
	// Shown at rest.
	'.badge { position: absolute; top: 0; right: 0; }',
	// Half-dimmed, not hidden.
	'.tag { position: absolute; top: 0; right: 0; opacity: 0.5; }',
	// The left corner.
	'.handle { position: absolute; top: 0; left: 0; opacity: 0; }',
	// Pinned to the bottom.
	'.zone { position: absolute; bottom: 0; right: 0; opacity: 0; }'
];

function styleOf(code: string): string {
	return [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

function markupOf(code: string): string {
	return code
		.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
		.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

describe('G4.180 every top-right hover control opts in to moving below the find bar', () => {
	it.each(HITS)('the matcher flags a corner control: %s', (css) => {
		expect(cornerControlRules(css)).toHaveLength(1);
	});

	it.each(MISSES)('the matcher spares a rule that is not one: %s', (css) => {
		expect(cornerControlRules(css)).toEqual([]);
	});

	const components = collectEditorSources().filter((f) => f.relPath.endsWith('.svelte'));
	const withControls = components
		.map((f) => ({ rel: f.relPath, code: f.code, rules: cornerControlRules(styleOf(f.code)) }))
		.filter((f) => f.rules.length > 0);

	it('finds the corner controls the editor and its bundled plugins ship', () => {
		expect(withControls.map((f) => f.rel).sort()).toEqual([
			'src/lib/components/blocks/code/CodeBlockRail.svelte',
			'src/lib/plugins/latex/BlockMath.svelte',
			'src/lib/plugins/mermaid/MermaidBlock.svelte'
		]);
	});

	it('marks each one in its markup', () => {
		const unmarked = withControls
			.filter((f) => !markupOf(f.code).includes(CORNER_CONTROL_ATTR))
			.map((f) => `${f.rel}: ${f.rules.join(', ')}`);
		expect(
			unmarked,
			`a control in a block's top-right corner needs \`${CORNER_CONTROL_ATTR}\` on its element, or the open find bar covers it`
		).toEqual([]);
	});
});
