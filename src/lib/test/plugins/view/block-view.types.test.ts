/**
 * Type pins for `defineBlockView`: a hand-built view must publish `focus`, each surface's `ctx`
 * carries only that surface, and the handle can't publish an editor-internal member. The
 * `@ts-expect-error` lines are the assertions, so `npm run check` fails if one starts compiling.
 */
import { it, expect } from 'vitest';
import { defineBlockView, type HandBuiltBlock } from '#lib/plugin.js';
import { MEMBER_SOURCES, type MemberSource } from '#lib/schema/block-view.js';
import type { BlockComponent } from '#lib/block-component.js';

export const handBuilt = defineBlockView({
	surface: 'none',
	mount: () => ({ focus() {}, getCursorOffset: () => null, focusable: true })
});

export const noFocus = defineBlockView({
	surface: 'none',
	// @ts-expect-error a hand-built view publishes `focus`; nothing else can focus it
	mount: () => ({ getCursorOffset: () => null, focusable: true })
});

export const leaf = defineBlockView({
	surface: 'leaf',
	mount(target, ctx) {
		ctx.leaf.attach(target);
		// @ts-expect-error a leaf view has no container surface
		void ctx.container;
		return {};
	}
});

export const none = defineBlockView({
	surface: 'none',
	mount(_target, ctx) {
		// @ts-expect-error a hand-built view has no leaf surface
		void ctx.leaf;
		return { focus() {}, getCursorOffset: () => null, focusable: true };
	}
});

export const container = defineBlockView({
	surface: 'container',
	mount(target, ctx) {
		ctx.container.mountChildren(target);
		// @ts-expect-error a container view has no leaf surface
		void ctx.leaf;
		return {};
	}
});

export const internal: HandBuiltBlock = {
	focus() {},
	getCursorOffset: () => null,
	focusable: true,
	// @ts-expect-error snapping the caret at a point is the editor's own, never a view's
	snapCaretToPoint() {}
};

// G3.18: a `BlockComponent` member with no source is a compile error at `MEMBER_SOURCES`; the
// record's keys are exactly the interface's.
export const everyMember: Record<keyof BlockComponent, MemberSource> = MEMBER_SOURCES;

it('compiles the pins above', () => {
	expect(handBuilt && noFocus && leaf && none && container && internal).toBeTruthy();
});
