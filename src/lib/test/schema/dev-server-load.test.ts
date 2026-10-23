// @vitest-environment jsdom
// Under a dev server's flags the entries load and every bundled plugin installs without tripping
// the setup-only registration guard (G1.104), so no module in the package registers at load.
// Miss-analysis: unit runs carry the test flag, so a module-scope registration failed only in an
// app's dev server.
import { it, expect, vi } from 'vitest';

it(
	'loads, bootstraps and installs every bundled plugin with dev on and no test flag',
	{ timeout: 60_000 },
	async () => {
		vi.resetModules();
		const { configureEditorEnv } = await import('#lib/testing.js');
		configureEditorEnv({ isDev: true, isTest: false });
		await import('#lib/index.js');
		await import('#lib/svelte.js');
		const { activateDirectives, declarePluginKind, parse } = await import('#lib/plugin.js');
		const { registerEditorBuiltIns } = await import('#lib/components/editor-built-ins.js');
		const { installPlugins } = await import('#lib/schema/plugin-install.js');
		const plugins = await Promise.all([
			import('#lib/plugins/admonitions/index.js').then((m) => m.admonitionsPlugin()),
			import('#lib/plugins/details/index.js').then((m) => m.detailsPlugin()),
			import('#lib/plugins/emoji/index.js').then((m) => m.emojiPlugin()),
			import('#lib/plugins/footnotes/index.js').then((m) => m.footnotesPlugin()),
			import('#lib/plugins/highlight-occurrences/index.js').then((m) =>
				m.highlightOccurrencesPlugin()
			),
			import('#lib/plugins/latex/index.js').then((m) => m.latexPlugin()),
			import('#lib/plugins/mermaid/index.js').then((m) => m.mermaidPlugin()),
			import('#lib/plugins/parrot/index.js').then((m) => m.parrotPlugin()),
			import('#lib/plugins/slash-commands/index.js').then((m) => m.slashCommandsPlugin()),
			import('#lib/plugins/toc/index.js').then((m) => m.tocPlugin())
		]);

		expect(() => {
			registerEditorBuiltIns();
			activateDirectives();
			installPlugins(plugins);
		}).not.toThrow();
		expect(parse('%%parrot hi\n\n:::note\nx\n:::\n').children.map((c) => c.kind)).toEqual([
			'parrot',
			'admonition'
		]);
		// The guard is live in this module graph, so the silence above is the package's own.
		expect(() => declarePluginKind('dev-load-bare')).toThrow(/outside a plugin's setup/);
	}
);

// The other route in: the parser's own first read registers the built-ins, with nothing else loaded.
it('registers the built-ins from the first grammar read with dev on and no test flag', async () => {
	vi.resetModules();
	const { configureEditorEnv } = await import('@voithos-labs/aragonite/dev-checks');
	configureEditorEnv({ isDev: true, isTest: false });
	const { parse } = await import('#lib/core/parser.js');
	expect(parse('# h\n\n- a\n').children.map((c) => c.kind)).toEqual(['heading', 'list']);
});
