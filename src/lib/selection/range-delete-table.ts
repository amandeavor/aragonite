/**
 * The `rangeDelete` branches for tables, whose selection offsets are cell indices, so no text
 * merges: a pair inside one table clears the cells it holds, and a kept table edge of a longer
 * range loses the whole rows the range covers.
 */

import type { Reading } from '../schema/reading';
import type { CstNode, Document } from '../core/nodes';
import { metadataOf } from '../core/nodes';
import type { SelectionPoint } from './primitives';
import type { RangeDeleteResult } from './range-delete';
import {
	isChromeChild,
	nearestChromeContainer,
	type CellRun,
	type GridCoverage,
	type RangeCoverage
} from './range-coverage';
import type { SharingState } from '../tree-operations/sharing';
import { displayLength } from '../core/lines';
import { cellRowCol } from '../caret/coordinate-spaces';
import { cellIndexOf } from './primitives';
import {
	planCrossBlockDeletion,
	applyPlannedDeletion,
	rebuildAfterDeletion,
	truncateEndInPlace,
	truncateStartInPlace
} from './range-delete-ceremony';
import { ensureUnsharedPath, ensureUnsharedSubtree } from '../tree-operations/unshare';
import { attachedChainPrefix, rebuildUnsharedChain } from '../tree-operations/chain-rebuild';
import { rebuildTableRowRaw } from '../schema/container-rebuilders';
import { caretWhereRangeResumes } from './range-delete-chrome';
import type { RemovalLanding } from './removal-landing';

// ── Public API ──────────────────────────────────────────────────────────────

/** Whether an edge the range keeps sits on a table, so its rows are cut rather than its text. */
export function keepsTableEdge(coverage: RangeCoverage): boolean {
	return coverage.startCells !== null || coverage.endCells !== null;
}

/** Clears the cells a pair inside one table holds, keeping the table's rows and columns; the
 *  caret goes in the start cell, so a follow-up paste or typed text lands inside the table. */
export function clearGridCells(
	doc: Document,
	coverage: RangeCoverage,
	grid: GridCoverage,
	sharing: SharingState,
	reading: Reading
): RangeDeleteResult {
	const chain = ensureUnsharedPath(doc, grid.path, sharing);
	const table = chain[chain.length - 1];
	ensureUnsharedSubtree(table, sharing);
	const { top, left, rows, cols } = grid.rect;
	for (let r = top; r < top + rows; r++) {
		const row = table.children![r];
		for (let c = left; c < left + cols; c++) row.children![c].raw = '';
		rebuildTableRowRaw(row);
	}
	rebuildUnsharedChain(doc, chain, sharing, null, reading.grammar);

	const columnCount = metadataOf(table, 'table').columnCount;
	const { row, col } = cellRowCol(
		cellIndexOf(coverage.range.start, 'clearGridCells:start'),
		columnCount
	);
	const anchor = { path: [...grid.path, row, col], offset: 0 };
	return { newDoc: doc, caret: () => anchor, tableRowSplices: [] };
}

/** Deletes a range that keeps a table edge: that table loses the rows from the start's row on,
 *  or up to the end's; a kept text edge is truncated in place and what lies between goes. */
export function tableAwareRangeDelete(
	doc: Document,
	coverage: RangeCoverage,
	sharing: SharingState,
	reading: Reading,
	landing: RemovalLanding
): RangeDeleteResult {
	const { grammar } = reading;
	const { start, end } = coverage.range;
	const { startEdge, endEdge } = coverage;

	// Copy both kept endpoint chains, and a kept table's whole subtree (cell raws, row splices and
	// the header promotion all write at depth), before any capture or mutation.
	const startChain = startEdge ? ensureUnsharedPath(doc, start.path, sharing) : null;
	const endChain = endEdge ? ensureUnsharedPath(doc, end.path, sharing) : null;
	const startBlock = startChain?.[startChain.length - 1] ?? null;
	const endBlock = endChain?.[endChain.length - 1] ?? null;
	const { startCells, endCells } = coverage;
	const startTable = startCells ? startBlock : null;
	const endTable = endCells ? endBlock : null;
	if (startTable) ensureUnsharedSubtree(startTable, sharing);
	if (endTable) ensureUnsharedSubtree(endTable, sharing);

	const startSplice = startTable && startCells ? deleteCoveredRows(startTable, startCells) : null;
	const endSplice = endTable && endCells ? deleteCoveredRows(endTable, endCells) : null;

	const plan = planCrossBlockDeletion(doc, coverage, [], sharing);
	// A kept text end truncates first, while its path is still valid, and never merges.
	if (endBlock && !endTable) {
		const endC = nearestChromeContainer(doc, end.path);
		truncateEndInPlace(
			doc,
			end,
			endBlock,
			endC !== null && isChromeChild(endC, end.path),
			reading,
			sharing,
			'tableAwareRangeDelete:end'
		);
	}
	applyPlannedDeletion(doc, plan, grammar);
	// Every deletion sits after the start in document order, so its path is still live.
	let seam: number | null = null;
	if (startBlock && !startTable) {
		const startC = nearestChromeContainer(doc, start.path);
		seam = truncateStartInPlace(
			doc,
			start,
			startBlock,
			startC !== null && isChromeChild(startC, start.path),
			reading,
			sharing,
			'tableAwareRangeDelete:start'
		);
	}

	for (const chain of [startChain, endChain]) {
		const attached = chain ? attachedChainPrefix(doc, chain) : [];
		if (attached.length > 0) rebuildUnsharedChain(doc, attached, sharing, null, grammar);
	}
	rebuildAfterDeletion(doc, plan, sharing, grammar);

	const tableRowSplices = [
		...(startTable && startSplice ? [{ table: startTable, ...startSplice }] : []),
		...(endTable && endSplice ? [{ table: endTable, ...endSplice }] : [])
	];
	if (landing.at === 'resume' || landing.at === 'beside') {
		const { root } = landing;
		return {
			newDoc: doc,
			caret: (committed) => caretWhereRangeResumes(committed, root),
			tableRowSplices
		};
	}
	const kept: SelectionPoint =
		landing.at === 'cell' && startTable && startCells
			? survivingAnchorCellCaret(startTable, start.path, startCells.from)
			: { path: start.path.slice(), offset: seam ?? 0 };
	return { newDoc: doc, caret: () => kept, tableRowSplices };
}

// ── Internal ────────────────────────────────────────────────────────────────

// The caret at the end of the last cell left above the start table's removed rows; the range
// starts at a row's first cell, so the row above is whole.
function survivingAnchorCellCaret(
	table: CstNode,
	startPath: number[],
	anchorCellIdx: number
): SelectionPoint {
	const cellsPerRow = metadataOf(table, 'table').columnCount;
	const row = cellRowCol(anchorCellIdx, cellsPerRow).row - 1;
	const col = cellsPerRow - 1;
	const cell = table.children![row].children![col];
	return { path: [...startPath, row, col], offset: displayLength(cell.raw) };
}

type RowSplice = { at: number; count: number };

/** Removes the whole rows a kept table edge hands to the range, returning the row window
 *  spliced, so the commit can sync row state. */
function deleteCoveredRows(table: CstNode, cells: CellRun): RowSplice {
	const cellsPerRow = metadataOf(table, 'table').columnCount;
	const at = cells.from / cellsPerRow;
	const count = (cells.to - cells.from) / cellsPerRow;
	table.children!.splice(at, count);
	return { at, count };
}
