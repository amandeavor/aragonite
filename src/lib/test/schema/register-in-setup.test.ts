// A plugin registers only from a `definePlugin` setup: in dev, a call anywhere else throws with the
// fix, and only the editor's own entries are ever replaced by a dev server's re-evaluation (G1.104).
// Miss-analysis: every registration test ran under Vitest's test flag, so nothing exercised a
// module-scope call the way an app's dev server runs it.
import { describe, it, expect, beforeEach } from 'vitest';
import { configureEditorEnv } from '#lib/testing.js';
import { definePlugin, installPlugins, registerAsCore } from '#lib/schema/plugin-install.js';
import { createPluginRegistry } from '#lib/schema/plugin-registry.js';
import { registerPasteTransform } from '#lib/tree-operations/paste/paste-transforms.js';
import { declarePluginKind, declaredPluginKind } from '#lib/schema/plugin-kind.js';
import { getBlockKindDescriptor } from '#lib/schema/block-kind-descriptor.js';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';

const asDevServer = () => configureEditorEnv({ isDev: true, isTest: false });
const transform = (name: string) => ({ name, transform: () => null });

describe('a registration outside a plugin setup', () => {
	beforeEach(asDevServer);

	it('throws in dev, naming definePlugin and the test-runner switch', () => {
		expect(() => registerPasteTransform(transform('bare'))).toThrow(
			/registerPasteTransform: called outside a plugin's setup.*definePlugin.*configureEditorEnv\(\{ isTest: true \}\)/
		);
		expect(() => declarePluginKind('bare-kind')).toThrow(/declarePluginKind: called outside/);
	});

	it('passes once a runner other than Vitest says it is a test', () => {
		configureEditorEnv({ isTest: true });
		expect(() => registerPasteTransform(transform('runner'))).not.toThrow();
	});

	it('passes inside a setup, and inside the editor’s own bootstraps', () => {
		installPlugins([
			definePlugin({ name: 'in-setup', setup: () => registerPasteTransform(transform('ok')) })
		]);
		expect(() => registerAsCore(() => registerPasteTransform(transform('core')))).not.toThrow();
	});
});

describe('a duplicate on a dev server', () => {
	beforeEach(asDevServer);

	it('replaces an editor-owned entry, with a note', () => {
		const registry = createPluginRegistry<string, number>({
			label: 'probe',
			isBuiltin: () => false
		});
		registry.registerCore('core-key', 1);
		expect(() => registry.registerCore('core-key', 2)).not.toThrow();
		expect(registry.getIgnoringActivation('core-key')).toBe(2);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['registry']);
	});

	it('throws for a plugin entry, as production does', () => {
		expect(() =>
			installPlugins([
				definePlugin({
					name: 'twice',
					setup() {
						registerPasteTransform(transform('dup'));
						registerPasteTransform(transform('dup'));
					}
				})
			])
		).toThrow(/already registered/);
	});

	// Hot reload re-evaluates a plugin's module into a new unit with the same name; the install
	// keeps the first and never re-runs a setup, so no plugin entry meets a duplicate.
	it('never reaches a plugin entry: a re-evaluated plugin module keeps the first registration', async () => {
		const first = await import('#lib/plugins/parrot/parrot-plugin.js');
		installPlugins([first.parrotPlugin()]);
		const registered = getBlockKindDescriptor(declaredPluginKind('parrot'));
		// A query makes a second instance of the module, sharing every registry with the first.
		const reevaluatedPath = '../../plugins/parrot/parrot-plugin.ts?reeval';
		const reevaluated: typeof first = await import(/* @vite-ignore */ reevaluatedPath);
		expect(reevaluated.parrotPlugin).not.toBe(first.parrotPlugin);
		installPlugins([reevaluated.parrotPlugin()]);

		expect(getBlockKindDescriptor(declaredPluginKind('parrot'))).toBe(registered);
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['plugin-install']);
	});
});
