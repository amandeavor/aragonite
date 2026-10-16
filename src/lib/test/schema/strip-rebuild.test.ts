// The line-prefixed rebuild (a quote, a list item) splicing one child: what each kind's per-line
// syntax does to the region, the opening line it must refuse to splice, and what it reads.
import { describe, it, expect } from 'vitest';
import { enablePerfInstruments, disablePerfInstruments } from '#lib/perf/instruments.js';
import {
	container,
	listItemMeta,
	paragraph,
	rewriteChild,
	spans
} from '#lib/test/harness/container-rebuild.js';

describe('the spliced region carries each kind’s own syntax', () => {
	it('re-quotes only the rewritten child, CRLF included', () => {
		const node = container('blockquote', [
			paragraph('a\r\n'),
			paragraph('b\r\n'),
			paragraph('c\r\n')
		]);
		expect(node.raw).toBe('> a\r\n> b\r\n> c\r\n');
		rewriteChild(node, 1, 'bb\r\nbbb\r\n');
		expect(node.raw).toBe('> a\r\n> bb\r\n> bbb\r\n> c\r\n');
		expect(spans(node)).toEqual([0, 5, 5, 18, 18, 23]);
	});

	it('keeps the marker on the first child and the indent under a wide one', () => {
		const node = container('listItem', [paragraph('one\n'), paragraph('two\n')], {
			metadata: listItemMeta('100. ')
		});
		expect(node.raw).toBe('100. one\n     two\n');
		rewriteChild(node, 1, 'two\nthree\n');
		expect(node.raw).toBe('100. one\n     two\n     three\n');
		rewriteChild(node, 0, 'first\n');
		expect(node.raw).toBe('100. first\n     two\n     three\n');
	});

	it('leaves a blank body line unindented and keeps the task marker', () => {
		const node = container('listItem', [paragraph('one\n'), paragraph('\n'), paragraph('two\n')], {
			metadata: listItemMeta('- ', '[x] ')
		});
		expect(node.raw).toBe('- [x] one\n\n  two\n');
		rewriteChild(node, 2, 'edited\n');
		expect(node.raw).toBe('- [x] one\n\n  edited\n');
	});

	it('keeps an inner suffix behind the last child’s region', () => {
		const node = container('blockquote', [paragraph('a\n'), paragraph('b\n')], {
			innerSuffix: '\n'
		});
		expect(node.raw).toBe('> a\n> b\n>\n');
		rewriteChild(node, 1, 'bb\n');
		expect(node.raw).toBe('> a\n> bb\n>\n');
	});
});

// Line 0 belongs to whichever child first carries one: filling an empty opening child moves the
// marker off the child that had it, which no single-region rewrite can express.
describe('the rebuild refuses a splice it cannot place', () => {
	it('re-derives when the emptied opening child takes back the first line', () => {
		const node = container('listItem', [paragraph(''), paragraph('text\n')], {
			metadata: listItemMeta('- ')
		});
		expect(node.raw).toBe('- text\n');
		rewriteChild(node, 0, 'x\n');
		expect(node.raw).toBe('- x\n  text\n');
	});
});

// Miss: only the perf gate saw a keystroke in a big quote's first child read every later sibling;
// no unit test counted what a one-child splice reads.
describe('a one-child splice reads only the child it rewrites', () => {
	it('never reads a later sibling for text that does not end blank', () => {
		const children = Array.from({ length: 2000 }, (_, i) => paragraph(`p${i}\n`, i ? '\n' : ''));
		const node = container('blockquote', children);
		// Counts indexed reads the way the editor's `$state` array pays for them, one trap each.
		let siblingReads = 0;
		node.children = new Proxy(children, {
			get(target, key, receiver) {
				if (typeof key === 'string' && Number(key) > 0) siblingReads++;
				return Reflect.get(target, key, receiver);
			}
		});
		// The perf instruments skip the dev belt's full rebuild, as they do in the perf gate.
		enablePerfInstruments();
		try {
			rewriteChild(node, 0, 'p0x\n');
		} finally {
			disablePerfInstruments();
		}
		expect(node.raw.startsWith('> p0x\n>\n> p1\n')).toBe(true);
		expect(siblingReads).toBe(0);
	});
});
