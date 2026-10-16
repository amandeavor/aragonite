import { describe, it, expect, afterEach } from 'vitest';
import { parse } from '../../core/parser';
import type { SelectionPoint } from '../../selection/primitives';
import { allowDevWarns } from '#lib/test/support/warn-gate.js';
import { TWO_COL_FOUR_ROW, TWO_COL_THREE_ROW, findTable } from './table-fixtures';
import { deleteRange } from '../harness/range-delete';

// rangeDelete is driven with hand-built endpoints, so the table branches see character offsets
// `SelectionState` would have snapped to cell coordinates first.
afterEach(() => allowDevWarns(['rangeCoverage:tableEdge']));

function run(source: string, start: SelectionPoint, end: SelectionPoint) {
	const doc = parse(source);
	const result = deleteRange(doc, start, end);
	return { doc: result.newDoc, splices: result.tableRowSplices };
}

describe('rangeDelete: tableRowSplices reporting', () => {
	// The cross-block commit reports each endpoint table's structural change from these splices
	// (matched by node identity) instead of re-deriving the snap.
	it('Case 1 reports the end table row prefix it removed', () => {
		const { doc, splices } = run(
			`intro\n\n${TWO_COL_FOUR_ROW}`,
			{ path: [0], offset: 2 },
			{ path: [1], offset: 3 }
		);

		const table = findTable(doc)!;
		expect(splices).toEqual([{ table, at: 0, count: 2 }]);
	});

	it('Case 2 reports the start table row suffix it removed', () => {
		const { doc, splices } = run(
			`${TWO_COL_FOUR_ROW}\nafter\n`,
			{ path: [0], offset: 2 },
			{ path: [1], offset: 0 }
		);

		const table = findTable(doc)!;
		expect(splices).toEqual([{ table, at: 1, count: 3 }]);
	});

	it('two-table span reports one splice per table', () => {
		const { doc, splices } = run(
			`${TWO_COL_THREE_ROW}\n${TWO_COL_THREE_ROW}`,
			{ path: [0], offset: 3 },
			{ path: [1], offset: 2 }
		);

		const [startTable, endTable] = doc.children;
		expect(splices).toEqual([
			{ table: startTable, at: 2, count: 1 },
			{ table: endTable, at: 0, count: 1 }
		]);
	});

	it('partial-row coverage that removes no rows reports no splice', () => {
		// End at cell 0: only half the header row is covered, so no whole row
		// is removed and no splice may be reported.
		const { doc, splices } = run(
			`intro\n\n${TWO_COL_FOUR_ROW}`,
			{ path: [0], offset: 2 },
			{ path: [1], offset: 0 }
		);

		const table = findTable(doc)!;
		expect(table.children).toHaveLength(4);
		expect(splices).toEqual([]);
	});
});
