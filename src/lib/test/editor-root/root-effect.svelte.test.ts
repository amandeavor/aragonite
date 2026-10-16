// @vitest-environment jsdom
// Each root listener is its own effect: a value one install reads re-runs that install alone, and
// unmounting the editor tears every install down.
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { createRootEffect } from '#lib/components/editor-root/root-effect.svelte.js';
import RootEffectHost from './fixtures/RootEffectHost.svelte';

describe('createRootEffect', () => {
	it('re-runs only the install whose value changed', () => {
		const root = document.createElement('div');
		const log: string[] = [];
		let mode = $state('source');
		const stop = $effect.root(() => {
			const rootEffect = createRootEffect(() => root);
			rootEffect(() => {
				log.push(`install mode ${mode}`);
				return () => log.push('teardown mode');
			});
			rootEffect(() => {
				log.push('install other');
				return () => log.push('teardown other');
			});
		});
		flushSync();
		log.length = 0;

		mode = 'live';
		flushSync();
		expect(log).toEqual(['teardown mode', 'install mode live']);
		stop();
	});

	it('installs nothing until the root mounts', () => {
		const log: string[] = [];
		let root = $state<HTMLElement | undefined>(undefined);
		const stop = $effect.root(() => {
			createRootEffect(() => root)(() => {
				log.push('install');
			});
		});
		flushSync();
		expect(log).toEqual([]);
		root = document.createElement('div');
		flushSync();
		expect(log).toEqual(['install']);
		stop();
	});

	it('tears every install down when the component unmounts', async () => {
		const log: string[] = [];
		const host = mount(RootEffectHost, { target: document.body, props: { log } });
		flushSync();
		expect(log).toEqual(['install first', 'install second']);
		await unmount(host);
		expect(log).toEqual(['install first', 'install second', 'teardown first', 'teardown second']);
	});
});
