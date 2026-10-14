// @vitest-environment jsdom
// The one wrapper every slot mounts a plugin view through: each throw is reported once, a view
// that threw is never called again, and a Svelte view's teardown throw is reported too.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync, type Component } from 'svelte';
import { mountPluginView, type PluginView } from '#lib/plugin-view.js';
import { svelteDecorationWidget, svelteInlineWidget } from '#lib/svelte-views.svelte.js';
import { domProbe, stages, svelteLog, viewExploded, type LogEntry } from './fixtures/probe-view';
import SvelteProbe from './fixtures/SvelteProbe.svelte';
import SourceReader from './fixtures/SourceReader.svelte';
import ThrowingTeardown from '../../components/fixtures/ThrowingTeardown.svelte';

beforeEach(() => void (svelteLog.length = 0));

function mountProbe(view: PluginView<{ n: number }>) {
	const report = vi.fn();
	const mounted = mountPluginView(
		view,
		document.createElement('span'),
		{ n: 0 },
		{
			report,
			subject: 'probe'
		}
	);
	return { mounted, report };
}

describe('mountPluginView', () => {
	it('is null and reports once when the mount throws', () => {
		const { mounted, report } = mountProbe(domProbe([], 'mount'));
		expect(mounted).toBeNull();
		expect(report.mock.calls).toEqual([[viewExploded]]);
	});

	it('answers false to an update that throws, tears the view down, and calls it no more', () => {
		const log: LogEntry[] = [];
		const { mounted, report } = mountProbe(domProbe(log, 'update'));
		expect(mounted!.update({ n: 1 })).toBe(false);
		expect(mounted!.update({ n: 2 })).toBe(false);
		mounted!.destroy();
		expect(stages(log)).toEqual(['mount', 'destroy']);
		expect(report.mock.calls).toEqual([[viewExploded]]);
	});

	it('keeps what a view without `update` drew', () => {
		const view: PluginView<{ n: number }> = (target) => {
			target.textContent = 'drawn';
			return {};
		};
		const target = document.createElement('span');
		const mounted = mountPluginView(view, target, { n: 0 }, { report: vi.fn(), subject: 'x' });
		expect(mounted!.update({ n: 1 })).toBe(true);
		expect(target.textContent).toBe('drawn');
	});

	it('destroys once however often it is asked, and reports a throwing destroy once', () => {
		const log: LogEntry[] = [];
		const { mounted, report } = mountProbe(domProbe(log, 'destroy'));
		mounted!.destroy();
		mounted!.destroy();
		expect(stages(log)).toEqual(['mount', 'destroy']);
		expect(report.mock.calls).toEqual([[viewExploded]]);
	});

	it('reports a Svelte view whose own teardown throws', async () => {
		const view = svelteDecorationWidget(ThrowingTeardown as Component as never);
		const report = vi.fn();
		const target = document.createElement('span');
		const mounted = mountPluginView(
			view,
			target,
			{ decoration: {} as never },
			{
				report,
				subject: 'probe'
			}
		);
		flushSync();
		mounted!.destroy();
		await Promise.resolve();
		expect(report.mock.calls).toEqual([[new Error('teardown exploded')]]);
	});
});

describe('the Svelte helpers', () => {
	it('keep a getter prop live instead of copying it at mount', () => {
		let reader = 'first';
		const props = {
			get computeInlineContent() {
				return reader;
			}
		};
		const view = svelteInlineWidget(SvelteProbe as never);
		mountPluginView(view, document.createElement('span'), props as never, {
			report: vi.fn(),
			subject: 'probe'
		});
		reader = 'second';
		const seen = svelteLog.find((entry) => entry.stage === 'mount')?.props as typeof props;
		expect(seen.computeInlineContent).toBe('second');
	});

	it('re-render only what reads a prop the update changed', () => {
		const getTheme = () => 'light';
		const props = (start: number) => ({ inline: { start }, source: '$x$', getTheme }) as never;
		const view = svelteInlineWidget(SourceReader as never);
		const mounted = mountPluginView(view, document.createElement('span'), props(0), {
			report: vi.fn(),
			subject: 'probe'
		});
		flushSync();
		mounted!.update(props(1));
		flushSync();
		mounted!.update({ ...(props(2) as object), source: '$y$' } as never);
		flushSync();
		expect(svelteLog.map((entry) => entry.props)).toEqual(['$x$', '$y$']);
	});
});
