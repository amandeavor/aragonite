// Each place the editor mounts a plugin view, driven through a real editor: set up with a view,
// then the gesture that hands the view new props and the one that drops it.
import type { PluginView } from '#lib/plugin-view.js';
import type { EditorError } from '#lib/editor-events.js';
import type { InlineWidgetComponentProps } from '#lib/core/inline/inline-widgets.js';
import { registerInlineWidgetKind } from '#lib/core/inline/inline-widgets.js';
import { registerInlineSyntax } from '#lib/core/inline/scan/plugin-syntax.js';
import { declarePluginInlineKind } from '#lib/schema/plugin-kind.js';
import type { Decoration, DecorationSourceHandle } from '#lib/decorations/types.js';
import type { InlineMenuRowProps } from '#lib/inline-menu/types.js';
import {
	blockHostAt,
	mountEditor,
	placeCaret,
	surfaceAt,
	typeInto,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey } from '#lib/test/harness/settle.js';
import { PROBE_CLASS } from './probe-view';

export interface SlotRun {
	errors: EditorError[];
	/** Where the view drew, or null where the slot shows its fallback. */
	drawn(): Element | null;
	/** Whether the slot's fallback is on screen in the view's place. */
	fellBack(): boolean;
	/** The gesture that hands every mounted view its next props. */
	update(): Promise<void>;
	/** The gesture that drops the view. */
	remove(): Promise<void>;
}

export interface Slot<P> {
	name: string;
	/** The dev warnings a failed mount adds beside its report: a decoration widget left out says so. */
	mountFailureWarns: string[];
	run(view: PluginView<P>): Promise<SlotRun>;
}

async function editorWith(source: string): Promise<{ m: MountedEditor; errors: EditorError[] }> {
	// Listening before the document loads, since a widget mounts with the first render.
	const m = mountEditor({ source: '', presentationMode: 'live' });
	const errors: EditorError[] = [];
	m.instance.getEvents().on('error', (error) => errors.push(error));
	m.props.source = source;
	await m.settle();
	return { m, errors };
}

const probeIn = (root: Element) => root.querySelector(`.${PROBE_CLASS}`);

export const inlineWidgetSlot: Slot<InlineWidgetComponentProps> = {
	name: 'an inline widget',
	mountFailureWarns: [],
	async run(view) {
		const kind = declarePluginInlineKind('viewSlotWidget');
		registerInlineSyntax('%', (raw, pos, end) => {
			if (!raw.startsWith('%%', pos)) return null;
			const close = raw.indexOf('%%', pos + 2);
			if (close < 0 || close + 2 > end) return null;
			return { kind, start: pos, end: close + 2, children: [] };
		});
		registerInlineWidgetKind(kind, { isWidget: () => true, view });
		const { m, errors } = await editorWith('a %%w%% b\n');
		const surface = () => surfaceAt(m, [0]);
		let typed = '';
		return {
			errors,
			drawn: () => probeIn(surface()),
			fellBack: () =>
				surface().querySelector('[data-inline-widget]') === null &&
				surface().textContent!.includes('%%w%%'),
			// Typing before the widget moves it, which is the one prop a pooled widget sees change.
			async update() {
				typed += 'x';
				typeInto(surface(), `${typed}a %%w%% b`);
				await m.settle();
			},
			async remove() {
				typeInto(surface(), 'xa b');
				await m.settle();
			}
		};
	}
};

/** Decorations from one source whose `invalidate` hands back fresh objects at the same place. */
async function decorated(
	source: string,
	provide: () => Decoration[]
): Promise<{ m: MountedEditor; errors: EditorError[]; handle: DecorationSourceHandle }> {
	const { m, errors } = await editorWith(source);
	const handle = m.instance.getDecorations().addSource({ name: 'probe', provide });
	await m.settle();
	return { m, errors, handle };
}

export const islandSlot: Slot<{ decoration: Decoration }> = {
	name: 'a decoration widget',
	mountFailureWarns: ['decorations'],
	async run(view) {
		const { m, errors, handle } = await decorated('hello world\n', () => [
			{ type: 'widget', path: [0], offset: 5, widget: { view } }
		]);
		const island = () => surfaceAt(m, [0]).querySelector('[data-decoration-island]');
		return {
			errors,
			drawn: () => probeIn(surfaceAt(m, [0])),
			fellBack: () => island() === null || island()!.childElementCount === 0,
			async update() {
				handle.invalidate();
				await m.settle();
			},
			async remove() {
				handle.dispose();
				await m.settle();
			}
		};
	}
};

export const badgeSlot: Slot<{ decoration: Decoration }> = {
	name: 'a block badge',
	mountFailureWarns: [],
	async run(view) {
		const { m, errors, handle } = await decorated('# Title\n', () => [
			{ type: 'block', path: [0], badge: { view } }
		]);
		return {
			errors,
			drawn: () => probeIn(blockHostAt(m, [0])),
			fellBack: () => blockHostAt(m, [0]).querySelector('.decoration-badge') === null,
			async update() {
				handle.invalidate();
				await m.settle();
			},
			async remove() {
				handle.dispose();
				await m.settle();
			}
		};
	}
};

export const menuRowSlot: Slot<InlineMenuRowProps> = {
	name: 'an inline menu row',
	mountFailureWarns: [],
	async run(view) {
		const { m, errors } = await editorWith('see\n');
		const items = () => ['a', 'b'].map((id) => ({ id, label: id, insert: `#${id}` }));
		m.instance.getInlineMenus().addSource({ name: 'tags', trigger: '#', items, row: view });
		placeCaret(surfaceAt(m, [0]), 3);
		m.instance.getInlineMenus().open('tags');
		await m.settle();
		const firstRow = () => m.target.ownerDocument.querySelector<HTMLElement>('[role="option"]');
		return {
			errors,
			drawn: () => (firstRow() ? probeIn(firstRow()!) : null),
			fellBack: () => firstRow()?.querySelector('.inline-menu-label')?.textContent === 'a',
			// Moving the active row changes the props of the two rows it leaves and lands on.
			async update() {
				await pressKey(surfaceAt(m, [0]), { key: 'ArrowDown' });
				await m.settle();
			},
			async remove() {
				await pressKey(surfaceAt(m, [0]), { key: 'Escape' });
				await m.settle();
			}
		};
	}
};

export const SLOTS = [inlineWidgetSlot, islandSlot, badgeSlot, menuRowSlot] as Slot<never>[];
