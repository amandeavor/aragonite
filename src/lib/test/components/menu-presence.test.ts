// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { tick } from 'svelte';
import {
	createMenuPresence,
	MENU_OPENED_IN_READING,
	type MenuCloseCause,
	type MenuPresence,
	type MenuTrackOptions
} from '#lib/components/menu/menu-presence.svelte.js';
import { takeDevWarns } from '../support/warn-gate';

/** A menu element in the page whose close unmounts it, as a real menu's does, and records why. */
function mountMenu(presence: MenuPresence, opts?: MenuTrackOptions, takesEscape = true) {
	const el = document.body.appendChild(document.createElement('div'));
	const causes: MenuCloseCause[] = [];
	// A close during the attach itself (reading mode) unmounts once the attach has returned.
	let detach: (() => void) | null = null;
	const unmount = (): void => {
		if (!el.isConnected) return;
		el.remove();
		detach?.();
	};
	detach = presence.track((cause) => {
		causes.push(cause);
		unmount();
		return takesEscape;
	}, opts)(el) as () => void;
	if (!el.isConnected) detach();
	return { el, causes, unmount };
}

const press = (target: Element) =>
	target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
const escape = (init: KeyboardEventInit = {}) => {
	const event = new KeyboardEvent('keydown', {
		key: 'Escape',
		bubbles: true,
		cancelable: true,
		...init
	});
	document.body.dispatchEvent(event);
	return event;
};

const presenceIn = (reading: boolean) => createMenuPresence({ isReading: () => reading });

afterEach(() => document.body.replaceChildren());

// The count `menuChange` reads: a menu swapped for another, or a flyout closing over its parent,
// must not read closed while one is still up.
describe('menu presence', () => {
	it('reads open while any tracked menu is mounted, closed once the last one unmounts', () => {
		const presence = presenceIn(false);
		expect(presence.isOpen).toBe(false);

		const menu = mountMenu(presence);
		mountMenu(presence).unmount();
		expect(presence.isOpen).toBe(true);

		menu.unmount();
		expect(presence.isOpen).toBe(false);
	});

	it.each(['mode-change', 'document-swap'] as const)(
		'closeAll(%s) hands that cause to every mounted menu, and to none that unmounted',
		(cause) => {
			const presence = presenceIn(false);
			const menu = mountMenu(presence);
			const flyout = mountMenu(presence);
			const gone = mountMenu(presence);
			gone.unmount();

			presence.closeAll(cause);

			expect([menu.causes, flyout.causes, gone.causes]).toEqual([[cause], [cause], []]);
		}
	);
});

// Miss-analysis: each menu checked reading mode at its own open, and nothing caught one that forgot.
describe('a menu opened in reading mode', () => {
	it('closes at once and warns when its rows write', () => {
		const menu = mountMenu(presenceIn(true), { edits: true });

		expect(menu.causes).toEqual(['mode-change']);
		expect(takeDevWarns().map((w) => w.tag)).toEqual([MENU_OPENED_IN_READING]);
	});

	it('stays open when its rows only read', () => {
		const presence = presenceIn(true);
		const menu = mountMenu(presence);

		expect(menu.causes).toEqual([]);
		expect(presence.isOpen).toBe(true);
		menu.unmount();
	});

	it('an editing menu outside reading mode stays open', () => {
		const menu = mountMenu(presenceIn(false), { edits: true });

		expect(menu.causes).toEqual([]);
		menu.unmount();
	});
});

// Miss-analysis: each menu closed on its own listener, one of them on its opener's focus, which
// Safari never gives a clicked button; no test ran a close with focus left on the page body.
describe('closing from outside the menu', () => {
	it('a press outside closes the menu, one inside it or on an inside element does not', () => {
		const presence = presenceIn(false);
		const opener = document.body.appendChild(document.createElement('button'));
		const menu = mountMenu(presence, { inside: () => [opener] });

		press(menu.el.appendChild(document.createElement('span')));
		press(opener);
		expect(menu.causes).toEqual([]);

		press(document.body);
		expect(menu.causes).toEqual(['outside-press']);
		expect(presence.isOpen).toBe(false);
	});

	it('Escape closes only the newest menu, so a flyout goes before its menu', () => {
		const presence = presenceIn(false);
		const menu = mountMenu(presence);
		const flyout = mountMenu(presence, { inside: () => [menu.el] });

		expect(escape().defaultPrevented).toBe(true);
		expect([menu.causes, flyout.causes]).toEqual([[], ['escape-key']]);
		escape();
		expect(menu.causes).toEqual(['escape-key']);
	});

	it('an uncounted popover closes the same way but never reads open', () => {
		const presence = presenceIn(false);
		const el = document.body.appendChild(document.createElement('div'));
		const causes: MenuCloseCause[] = [];
		const detach = presence.trackUncounted((cause) => {
			causes.push(cause);
			return true;
		})(el) as () => void;

		expect(presence.isOpen).toBe(false);
		expect(escape().defaultPrevented).toBe(true);
		press(document.body);
		expect(causes).toEqual(['escape-key', 'outside-press']);
		detach();
	});

	it('an Escape the menu does not take still reaches the page; a composing one closes nothing', () => {
		const menu = mountMenu(presenceIn(false), undefined, false);
		const reached = vi.fn();
		document.body.addEventListener('keydown', reached);

		escape({ isComposing: true });
		expect(menu.causes).toEqual([]);
		expect(escape().defaultPrevented).toBe(false);
		expect(menu.causes).toEqual(['escape-key']);
		expect(reached).toHaveBeenCalledTimes(2);
		document.body.removeEventListener('keydown', reached);
	});

	it('listens at the document only while a menu is open', () => {
		const presence = presenceIn(false);
		const add = vi.spyOn(document, 'addEventListener');
		const remove = vi.spyOn(document, 'removeEventListener');
		const menu = mountMenu(presence);
		mountMenu(presence).unmount();
		expect(remove).not.toHaveBeenCalled();

		menu.unmount();
		expect(add.mock.calls.map((c) => c[0])).toEqual(['pointerdown', 'keydown']);
		expect(remove.mock.calls.map((c) => c[0])).toEqual(['pointerdown', 'keydown']);
		add.mockRestore();
		remove.mockRestore();
	});

	it('warns when a menu asked to close is still mounted a tick later (G1.121)', async () => {
		const presence = presenceIn(false);
		const el = document.body.appendChild(document.createElement('div'));
		const unmount = presence.track(() => true)(el) as () => void;

		press(document.body);
		await tick();
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['invariant:menu-closes']);
		unmount();
	});
});
