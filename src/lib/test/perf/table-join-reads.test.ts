// A block flush under a table that its first line ends is asked no parse of the table: the join
// question once read the whole table twice on every edit beside it.
// Miss-analysis: the join rows asserted bytes, which the two parses got right, never their cost.
import { describe, it, expect, afterEach } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import { separateJoin } from '#lib/tree-operations/neighbour-merge.js';
import { documentBody } from '#lib/tree-operations/node-primitives.js';
import { createSharingState } from '#lib/tree-operations/sharing.js';
import { defaultGrammarView } from '#lib/schema/block-openers.js';
import {
	disablePerfInstruments,
	enablePerfInstruments,
	perfSnapshot,
	resetPerfInstruments
} from '#lib/perf/instruments.js';

afterEach(() => disablePerfInstruments());

const rows = (n: number) => Array.from({ length: n }, (_, i) => `| r${i} |\n`).join('');

describe('the join question under a table', () => {
	it.each(['# heading\n', '---\n', '- item\n'])('reads nothing for %j', (follower) => {
		const source = `| a |\n| - |\n${rows(200)}${follower}`;
		const doc = parse(source);
		expect(doc.children.map((c) => c.kind)[0]).toBe('table');
		enablePerfInstruments();
		resetPerfInstruments();

		separateJoin(documentBody(doc), 1, 'placed', defaultGrammarView, createSharingState());

		expect(perfSnapshot().parseBytes).toBe(0);
		expect(serialize(doc)).toBe(source);
	});
});
