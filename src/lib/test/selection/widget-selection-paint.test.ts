// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installWidgetSelectionPainter } from '../../selection/widget-selection-paint';
import type { WidgetTarget } from '../../selection/primitives';

describe('installWidgetSelectionPainter', () => {
	let editorRoot: HTMLElement;
	let para: HTMLElement;
	let leadText: Text;
	let widgetA: HTMLElement;
	let midText: Text;
	let widgetB: HTMLElement;
	let trailText: Text;
	let abort: AbortController;

	beforeEach(() => {
		editorRoot = document.createElement('div');
		para = document.createElement('p');
		para.setAttribute('data-block-path', '[0]');
		leadText = document.createTextNode('lead ');
		widgetA = document.createElement('span');
		widgetA.setAttribute('data-image-widget', '');
		widgetA.setAttribute('data-inline-widget', '');
		widgetA.setAttribute('contenteditable', 'false');
		widgetA.setAttribute('data-source-start', '5');
		midText = document.createTextNode(' mid ');
		widgetB = document.createElement('span');
		widgetB.setAttribute('data-image-widget', '');
		widgetB.setAttribute('data-inline-widget', '');
		widgetB.setAttribute('contenteditable', 'false');
		widgetB.setAttribute('data-source-start', '12');
		trailText = document.createTextNode(' trail');

		const content = document.createElement('div');
		content.append(leadText, widgetA, midText, widgetB, trailText);
		para.appendChild(content);
		editorRoot.appendChild(para);
		document.body.appendChild(editorRoot);

		abort = new AbortController();
	});

	afterEach(() => {
		abort.abort();
		editorRoot.remove();
	});

	interface Reads {
		customRendered: boolean;
		held: WidgetTarget | null;
		drawnElsewhere: boolean;
	}

	function install(reads: Partial<Reads> = {}) {
		const state: Reads = { customRendered: false, held: null, drawnElsewhere: false, ...reads };
		const painter = installWidgetSelectionPainter({
			editorRoot,
			getSelectionIsCustomRendered: () => state.customRendered,
			getHeldWidget: () => state.held,
			getHeldWidgetDrawnElsewhere: () => state.drawnElsewhere,
			lifetime: abort.signal
		});
		return { state, repaint: painter.repaint };
	}

	const HELD_B: WidgetTarget = { paragraphPath: [0], sourceStart: 12, preSelectOffset: 12 };

	function setRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): void {
		const sel = window.getSelection()!;
		sel.removeAllRanges();
		const r = document.createRange();
		r.setStart(startNode, startOffset);
		r.setEnd(endNode, endOffset);
		sel.addRange(r);
		document.dispatchEvent(new Event('selectionchange'));
	}

	it('adds md-widget-selected only to widgets the range intersects', () => {
		install();
		setRange(leadText, 0, midText, 2);
		expect(widgetA.classList.contains('md-widget-selected')).toBe(true);
		expect(widgetB.classList.contains('md-widget-selected')).toBe(false);
	});

	it('removes the class when selection collapses', () => {
		install();
		setRange(leadText, 0, midText, 2);
		expect(widgetA.classList.contains('md-widget-selected')).toBe(true);

		const sel = window.getSelection()!;
		sel.removeAllRanges();
		document.dispatchEvent(new Event('selectionchange'));

		expect(widgetA.classList.contains('md-widget-selected')).toBe(false);
	});

	it('clears classes while the cross-block overlay draws the range', () => {
		const { state } = install();

		setRange(leadText, 0, trailText, 6);
		expect(widgetA.classList.contains('md-widget-selected')).toBe(true);
		expect(widgetB.classList.contains('md-widget-selected')).toBe(true);

		state.customRendered = true;
		document.dispatchEvent(new Event('selectionchange'));

		expect(widgetA.classList.contains('md-widget-selected')).toBe(false);
		expect(widgetB.classList.contains('md-widget-selected')).toBe(false);
	});

	it('paints the widget held selected whole, and only that one, on repaint', () => {
		const { state, repaint } = install();
		setRange(leadText, 0, midText, 2);
		expect(widgetA.classList.contains('md-widget-selected')).toBe(true);

		state.held = HELD_B;
		repaint();
		expect(widgetA.classList.contains('md-widget-selected')).toBe(false);
		expect(widgetB.classList.contains('md-widget-selected')).toBe(true);

		state.held = null;
		window.getSelection()!.removeAllRanges();
		repaint();
		expect(widgetB.classList.contains('md-widget-selected')).toBe(false);
	});

	it('paints a held widget again once a re-render rebuilt its element', () => {
		const { repaint } = install({ held: HELD_B });
		repaint();
		const rebuilt = widgetB.cloneNode(true) as HTMLElement;
		rebuilt.classList.remove('md-widget-selected');
		widgetB.replaceWith(rebuilt);

		repaint();
		expect(rebuilt.classList.contains('md-widget-selected')).toBe(true);
	});

	it('leaves the held widget to the view that draws it', () => {
		const { state, repaint } = install({ held: HELD_B, drawnElsewhere: true });
		repaint();
		expect(widgetB.classList.contains('md-widget-selected')).toBe(false);

		state.drawnElsewhere = false;
		repaint();
		expect(widgetB.classList.contains('md-widget-selected')).toBe(true);
	});

	it('ignores selections outside the editor root', () => {
		install();
		const outside = document.createElement('p');
		outside.textContent = 'outside';
		document.body.appendChild(outside);
		try {
			setRange(outside.firstChild!, 0, outside.firstChild!, 4);
			expect(widgetA.classList.contains('md-widget-selected')).toBe(false);
			expect(widgetB.classList.contains('md-widget-selected')).toBe(false);
		} finally {
			outside.remove();
		}
	});

	it('lifetime abort removes the listener and clears what it painted', () => {
		install();
		setRange(leadText, 0, midText, 2);
		expect(widgetA.classList.contains('md-widget-selected')).toBe(true);

		abort.abort();
		expect(widgetA.classList.contains('md-widget-selected')).toBe(false);

		// The listener is gone, so a later selectionchange paints nothing.
		setRange(midText, 0, trailText, 4);
		expect(widgetB.classList.contains('md-widget-selected')).toBe(false);
	});
});
