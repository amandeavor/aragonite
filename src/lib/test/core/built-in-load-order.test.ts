// Built-ins register on the first grammar read, so whichever module a host imports first, a parse
// finds every built-in kind and opener (G4.197).
// Miss-analysis: every suite entered through `core/inline` or the editor, the two entries that
// registered the descriptors, so a pipeline entering through the parser never ran under test.
import { describe, expect, it, vi } from 'vitest';

const FIXTURE = [
	'# h',
	'',
	'    code',
	'',
	'```js',
	'x',
	'```',
	'',
	'> q',
	'',
	'- a',
	'',
	'<div>',
	'',
	'[r]: /u',
	'',
	'---',
	'',
	'| a |',
	'| - |',
	'| b |',
	''
].join('\n');

const OPENED_KINDS = [
	'heading',
	'indentedCode',
	'fencedCode',
	'blockquote',
	'list',
	'htmlBlock',
	'linkReferenceDefinition',
	'thematicBreak',
	'table'
];

// The modules on the parser's import cycle, plus the two entries that always worked.
const ENTRIES = [
	'#lib/core/parser.js',
	'#lib/core/inline/index.js',
	'#lib/schema/built-in-descriptors.js',
	'#lib/schema/container-rebuilders.js',
	'#lib/core/parsers/list.js',
	'#lib/core/parsers/built-in-openers.js',
	'#lib/schema/block-kind-descriptor.js',
	'#lib/schema/block-openers.js',
	'#lib/index.js'
];

async function parsedKinds(): Promise<string[]> {
	const { parse } = await import('#lib/core/parser.js');
	return parse(FIXTURE)
		.children.map((child) => child.kind)
		.filter((kind) => kind !== 'paragraph');
}

describe('built-ins register on the first grammar read', () => {
	it.each(ENTRIES)(
		'importing %s first still parses every built-in',
		{ timeout: 60_000 },
		async (entry) => {
			vi.resetModules();
			await import(/* @vite-ignore */ entry);
			expect(await parsedKinds()).toEqual(OPENED_KINDS);
			const { getBlockKindDescriptor } = await import('#lib/schema/block-kind-descriptor.js');
			expect(getBlockKindDescriptor('list').isContainer).toBe(true);
		}
	);

	// The first read can happen inside a plugin's setup; the built-ins it registers still belong to
	// no plugin, so they outlive the test reset and a setup that throws.
	it(
		'keeps the built-ins a plugin setup registered through a reset and a failed setup',
		{ timeout: 60_000 },
		async () => {
			vi.resetModules();
			const { definePlugin, installPlugins } = await import('#lib/schema/plugin-install.js');
			const { parse } = await import('#lib/core/parser.js');
			const reader = definePlugin({
				name: 'first-reader',
				setup() {
					parse('# first read\n');
					throw new Error('setup fails after the first read');
				}
			});
			expect(() => installPlugins([reader])).toThrow(/setup fails/);
			expect(await parsedKinds()).toEqual(OPENED_KINDS);

			const { resetPluginPlatformForTests } = await import('#lib/testing.js');
			resetPluginPlatformForTests();
			expect(await parsedKinds()).toEqual(OPENED_KINDS);
		}
	);
});
