// Presses keys in the mounted editor and writes down what each did, through the editor's public
// reads only: `getSource()` for the bytes, `getSelection()` for the caret, and the undo and redo
// commands. Each single key gets a fresh mount, so no row depends on the rows run before it.

import type { PresentationMode } from '#lib/presentation-mode.js';
import type { CstNode } from '#lib/core/nodes.js';
import { parse } from '#lib/core/parser.js';
import { trimTrailingLineEnding } from '#lib/core/lines.js';
import { getContentRange } from '#lib/core/inline/index.js';
import {
	blockHostAt,
	mountEditor,
	placeCaret,
	surfaceAt,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressHardwareKey } from '#lib/test/harness/insertion-routes.js';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';
import { makeRng } from '#lib/e2e/simulation/rng.js';
import { KEYS, SYNTAX_PLUGINS, type Key } from './corpus';
import { caretField, textField, undoField, warnsField, type Row } from './rows';

/** Where a caret goes: a leaf block by its CST path, or one cell of the table at that path. */
export interface Site {
	path: number[];
	cell?: [row: number, column: number];
	/** Where the leaf's content starts (past its marker) and the last offset a caret can take. */
	start: number;
	end: number;
}

const siteName = ({ path, cell }: Site) =>
	`[${path.join(',')}]${cell ? ` r${cell[0]}c${cell[1]}` : ''}`;

function mount(source: string, mode: PresentationMode): MountedEditor {
	return mountEditor({ source, presentationMode: mode, plugins: SYNTAX_PLUGINS });
}

/** Every leaf block of `source`, and each cell of each table, read off a mount so a cell's text
 *  length is what the cell renders. */
export async function sitesOf(source: string, mode: PresentationMode): Promise<Site[]> {
	const editor = mount(source, mode);
	await editor.settle();
	const sites: Site[] = [];
	for (const { path, node } of leaves(parse(source).children, [])) {
		const cells = node.kind === 'table' ? tableCells(editor, path) : [];
		if (cells.length === 0) sites.push(leafSite(path, node));
		for (const cell of cells) sites.push(cell);
	}
	await editor.destroy();
	// Each key's own mount fires whatever this one did, and its row lists it.
	takeDevWarns();
	return sites;
}

const leafSite = (path: number[], node: CstNode): Site => ({
	path,
	start: getContentRange(node).start,
	end: trimTrailingLineEnding(node.raw).length
});

function leaves(nodes: readonly CstNode[], prefix: number[]) {
	const found: { path: number[]; node: CstNode }[] = [];
	nodes.forEach((node, i) => {
		const path = [...prefix, i];
		if (node.children) found.push(...leaves(node.children, path));
		else found.push({ path, node });
	});
	return found;
}

function tableCells(editor: MountedEditor, path: number[]): Site[] {
	const rows = blockHostAt(editor, path).querySelectorAll('[data-table-row-idx]');
	return [...rows].flatMap((row, r) =>
		[...row.querySelectorAll(':scope > .table-cell')].map((cell, c) => ({
			path,
			cell: [r, c] as [number, number],
			start: 0,
			end: cell.textContent?.length ?? 0
		}))
	);
}

function surfaceOf(editor: MountedEditor, site: Site): HTMLElement {
	if (!site.cell) return surfaceAt(editor, site.path);
	const row = blockHostAt(editor, site.path).querySelectorAll('[data-table-row-idx]')[site.cell[0]];
	const cell = row?.querySelectorAll<HTMLElement>(':scope > .table-cell')[site.cell[1]];
	if (!cell) throw new Error(`no cell ${siteName(site)}`);
	return cell;
}

/** The site's surface with the caret put at `offset`; null where the surface isn't mounted or
 *  can't take a caret there (a hidden marker in live mode, a block with no text surface). */
function placeAt(editor: MountedEditor, site: Site, offset: number): HTMLElement | null {
	try {
		const el = surfaceOf(editor, site);
		placeCaret(el, offset);
		return el;
	} catch {
		return null;
	}
}

// ── Single keys ──────────────────────────────────────────────────────────────

/** A row for each key at `offset`, or one `no caret` row when the caret can't go there. */
export async function keyRows(
	label: string,
	source: string,
	mode: PresentationMode,
	site: Site,
	offset: number,
	keys: readonly Key[] = KEYS
): Promise<Row[]> {
	const rows: Row[] = [];
	for (const key of keys) {
		const editor = mount(source, mode);
		await editor.settle();
		const el = placeAt(editor, site, offset);
		const at = `${label} ${siteName(site)}@${offset}`;
		if (!el) {
			await editor.destroy();
			rows.push({ in: `${at} *`, took: 'no caret', warns: warnsField(tagsTaken()) });
			return rows;
		}
		const took = await pressHardwareKey(el, key.init);
		const edited = editor.source();
		const caret = caretField(editor.instance.getSelection());
		const { undone, redone } = await undoThenRedo(editor);
		await editor.destroy();
		rows.push({
			in: `${at} ${key.name}`,
			took,
			bytes: textField(source, edited),
			caret,
			undo: undoField(source, edited, undone, redone),
			warns: warnsField(tagsTaken())
		});
	}
	return rows;
}

async function undoThenRedo(editor: MountedEditor) {
	editor.instance.runCommand('history.undo');
	await editor.settle();
	const undone = editor.source();
	editor.instance.runCommand('history.redo');
	await editor.settle();
	return { undone, redone: editor.source() };
}

const tagsTaken = () => takeDevWarns().map((record) => record.tag);

// ── Seeded sequences ─────────────────────────────────────────────────────────

/** More runs than a sequence's keys can make undo entries. */
const UNWIND_LIMIT = 60;

/** `steps` keys drawn from `seed` into one mount of `source`, a row per key, then a row for
 *  undoing every entry and redoing them all: the grouping of a typing run shows only there. */
export async function sequenceRows(
	label: string,
	seed: number,
	source: string,
	mode: PresentationMode,
	steps: number
): Promise<Row[]> {
	const rng = makeRng(seed);
	const editor = mount(source, mode);
	await editor.settle();
	const rows: Row[] = [];
	for (let step = 0; step < steps; step++) {
		const before = editor.source();
		const sites = leaves(parse(before).children, []).map(({ path, node }) => leafSite(path, node));
		const site = rng.pick(sites);
		const offset = rng.int(0, site.end + 1);
		const key = rng.pick(KEYS);
		const el = placeAt(editor, site, offset);
		const took = el ? await pressHardwareKey(el, key.init) : 'no caret';
		rows.push({
			in: `${label} step ${String(step).padStart(2, '0')}`,
			do: `${siteName(site)}@${offset} ${key.name}`,
			took,
			bytes: textField(before, editor.source()),
			caret: caretField(editor.instance.getSelection()),
			warns: warnsField(tagsTaken())
		});
	}
	const edited = editor.source();
	// The undo command needs a focused block, and the last key may have left none.
	placeAt(editor, { path: leaves(parse(edited).children, [])[0].path, start: 0, end: 0 }, 0);
	const undo = await repeat(editor, 'history.undo');
	const undone = editor.source();
	const redo = await repeat(editor, 'history.redo');
	const redone = editor.source();
	await editor.destroy();
	rows.push({
		in: `${label} unwind`,
		do: `undo changed the bytes ${undo} times, redo ${redo}`,
		undo: undoField(source, edited, undone, redone),
		warns: warnsField(tagsTaken())
	});
	return rows;
}

/** How many of `UNWIND_LIMIT` runs of `command` changed the bytes. A fixed count, since the
 *  command stays enabled on an empty stack and an undo step may leave the bytes alone. */
async function repeat(editor: MountedEditor, command: string): Promise<number> {
	let changed = 0;
	for (let run = 0; run < UNWIND_LIMIT; run++) {
		const before = editor.source();
		editor.instance.runCommand(command);
		await editor.settle();
		if (editor.source() !== before) changed++;
	}
	return changed;
}
