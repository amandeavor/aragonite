import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Svelte showcase builds its plugins on repo source and the React and Vue showcases on the
 * installed package, so the two lists are separate files; this holds them to the same plugin
 * factories in the same order, so the three showcases stay comparable.
 */

// A factory call such as `tocPlugin()` or `latexPlugin({ renderer: katexRenderer })`, never the
// declaration of a local factory.
const FACTORY_CALL = /(?<!function )\b(\w+Plugin)\((?:\{[^()]*\})?\)/g;

function factoryCalls(file: string): string[] {
	return [...readFileSync(file, 'utf8').matchAll(FACTORY_CALL)].map((match) => match[1]);
}

describe('showcase plugin lists', () => {
	it('the Svelte and framework showcases create the same plugins in the same order', () => {
		const svelte = factoryCalls('src/routes/demo-plugins.ts');
		expect(svelte.length).toBeGreaterThan(5);
		expect(factoryCalls('examples/showcase/plugins.ts')).toEqual(svelte);
	});
});
