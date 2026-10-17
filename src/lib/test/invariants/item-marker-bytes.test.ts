// G1.113: the marker a list item draws is its own opening bytes, for every item the parser reads.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse } from '#lib/core/parser.js';
import { metadataOf, type CstNode } from '#lib/core/nodes.js';
import { walkBlocks } from '#lib/core/paths.js';
import { buildTaskItemAmbient } from '#lib/components/blocks/list/task-checkbox.js';
import { checkItemMarkerBytes } from '#lib/invariants/item-marker-bytes.js';
import {
	arbGfmDoc,
	arbIndentedGfmDoc,
	arbRespelledContainerDoc,
	freshOrFixedSeed
} from './arbitraries';

const PARAMS = { numRuns: 300, seed: freshOrFixedSeed(113113) } as const;

function drawnMarker(item: CstNode): string {
	const prefix = buildTaskItemAmbient(metadataOf(item, 'listItem'), () => {}, false);
	return typeof prefix === 'string' ? prefix : prefix.text;
}

function itemsOf(source: string): CstNode[] {
	const items: CstNode[] = [];
	walkBlocks(parse(source), (node) => {
		if (node.kind === 'listItem') items.push(node);
	});
	return items;
}

const violationsIn = (source: string) =>
	itemsOf(source)
		.map((item) => checkItemMarkerBytes(item.raw, drawnMarker(item)))
		.filter((v) => v !== null);

describe('G1.113 a list item draws its own bytes as its marker', () => {
	it.each([
		['a bullet', '- a\n'],
		['an indented bullet', ' - a\n'],
		['a wide marker', '*   a\n'],
		['a tab after the marker', '-\ta\n'],
		['a closing paren', '1) a\n'],
		['a nested item', '- a\n  - b\n'],
		['a to-do', '- [x] a\n'],
		['an empty to-do', '- [ ] \n'],
		['an item in a quote', '> 10.  a\n'],
		['CRLF', '- a\r\n- b\r\n']
	])('%s', (_shape, source) => {
		expect(itemsOf(source).length).toBeGreaterThan(0);
		expect(violationsIn(source)).toEqual([]);
	});

	it('for every item of a generated document', () => {
		for (const arb of [arbGfmDoc, arbIndentedGfmDoc, arbRespelledContainerDoc]) {
			fc.assert(
				fc.property(arb, (source) => violationsIn(source).length === 0),
				PARAMS
			);
		}
	});

	it('fails a marker the bytes do not hold', () => {
		expect(checkItemMarkerBytes('- [ ] a\n', '- [x] ')?.message).toContain('"- [ ] "');
		expect(checkItemMarkerBytes('1. a\n', '2. ')?.code).toBe('item-marker-bytes');
	});
});
