// @vitest-environment jsdom
// Miss-analysis: overlays re-measured only on scroll and resize, and no test moved text inside a
// block whose box stayed the same size.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { tick } from 'svelte';
import { createTextMoves } from '#lib/components/overlays/text-moves.js';

afterEach(() => {
	document.body.replaceChildren();
});

function host(path: number[], parent: Element = document.body): HTMLElement {
	const el = document.createElement('div');
	el.setAttribute('data-block-path', JSON.stringify(path));
	parent.append(el);
	return el;
}

/** A quote holding a paragraph, beside a second paragraph, each with a watched overlay. */
function blocks() {
	const moves = createTextMoves();
	const quote = host([0]);
	const inner = host([0, 0], quote);
	const other = host([1]);
	const text = document.createElement('span');
	inner.append(text);
	const measures = { quote: vi.fn(), inner: vi.fn(), other: vi.fn() };
	const disposers = {
		quote: moves.watch(quote, measures.quote),
		inner: moves.watch(inner, measures.inner),
		other: moves.watch(other, measures.other)
	};
	return { moves, quote, inner, other, text, measures, disposers };
}

describe('createTextMoves', () => {
	it('measures the block holding the moved text and the containers around it, a tick later', async () => {
		const b = blocks();

		b.moves.movedWithin(b.text);
		expect(b.measures.inner).not.toHaveBeenCalled();
		await tick();

		expect(b.measures.inner).toHaveBeenCalledTimes(1);
		expect(b.measures.quote).toHaveBeenCalledTimes(1);
		expect(b.measures.other).not.toHaveBeenCalled();
	});

	it('measures every block inside a container whose own state moved them', async () => {
		const b = blocks();

		b.moves.movedWithin(b.quote);
		await tick();

		expect(b.measures.quote).toHaveBeenCalledTimes(1);
		expect(b.measures.inner).toHaveBeenCalledTimes(1);
		expect(b.measures.other).not.toHaveBeenCalled();
	});

	it('measures once per block however many moves land before the tick', async () => {
		const b = blocks();

		b.moves.movedWithin(b.text);
		b.moves.movedWithin(b.inner);
		b.moves.movedEverywhere();
		await tick();

		expect(b.measures.inner).toHaveBeenCalledTimes(1);
		expect(b.measures.other).toHaveBeenCalledTimes(1);
	});

	it('skips an overlay disposed before the tick', async () => {
		const b = blocks();

		b.moves.movedEverywhere();
		b.disposers.other();
		await tick();

		expect(b.measures.other).not.toHaveBeenCalled();
		expect(b.measures.inner).toHaveBeenCalledTimes(1);
	});

	it('reports an image that finishes loading, or fails to, inside a block', async () => {
		const b = blocks();
		const stop = b.moves.install(document.body);
		const img = document.createElement('img');
		b.other.append(img);

		img.dispatchEvent(new Event('load'));
		await tick();
		img.dispatchEvent(new Event('error'));
		await tick();
		stop();
		img.dispatchEvent(new Event('load'));
		await tick();

		expect(b.measures.other).toHaveBeenCalledTimes(2);
		expect(b.measures.inner).not.toHaveBeenCalled();
	});

	it('reports a font load to every block', async () => {
		const fonts = new EventTarget();
		Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
		const b = blocks();
		const stop = b.moves.install(document.body);

		fonts.dispatchEvent(new Event('loadingdone'));
		await tick();
		stop();
		delete (document as { fonts?: unknown }).fonts;

		expect(b.measures.inner).toHaveBeenCalledTimes(1);
		expect(b.measures.other).toHaveBeenCalledTimes(1);
	});
});
