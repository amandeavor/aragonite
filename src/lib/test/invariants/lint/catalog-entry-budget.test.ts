/**
 * G4.218: an invariant catalog entry (a paragraph opening `**G<n>.<m> ·` in a group file under
 * `docs/design/invariants/`) holds at most six lines and 600 characters, so it carries the rule,
 * its why and its files rather than the mechanism. The baseline only shrinks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectFiles } from './scan-source';
import { SOURCE_DIR } from './source-paths';

const MAX_LINES = 6;
// Six lines at Prettier's 100 columns, so long lines can't stand in for more of them.
const MAX_CHARS = 600;

/** Entries allowed past the budget, keyed `file:G-number`, each with why it needs the room. */
const BASELINE: Record<string, string> = {};

interface CatalogEntry {
	file: string;
	id: string;
	lines: number;
	chars: number;
}

function catalogEntries(file: string, markdown: string): CatalogEntry[] {
	const lines = markdown.split(/\r?\n/);
	const entries: CatalogEntry[] = [];
	for (let i = 0; i < lines.length; i++) {
		const id = /^\*\*(G\d+\.\d+) ·/.exec(lines[i])?.[1];
		if (!id) continue;
		let end = i;
		while (end < lines.length && lines[end].trim() !== '') end++;
		const paragraph = lines.slice(i, end);
		entries.push({ file, id, lines: paragraph.length, chars: paragraph.join(' ').length });
		i = end;
	}
	return entries;
}

const isOver = (e: CatalogEntry) => e.lines > MAX_LINES || e.chars > MAX_CHARS;
const keyOf = (e: CatalogEntry) => `${e.file}:${e.id}`;
const describeEntry = (e: CatalogEntry) =>
	`${e.file} ${e.id}: ${e.lines} lines, ${e.chars} characters`;

describe('G4.218 an invariant catalog entry stays within six lines', () => {
	const files = collectFiles(SOURCE_DIR.invariantCatalog, { extensions: ['.md'] });
	const entries = files.flatMap((file) => catalogEntries(file, readFileSync(file, 'utf8')));

	it('reads every group file and finds their entries', () => {
		for (const group of ['runtime', 'tested', 'compile-time', 'scans']) {
			const file = `${SOURCE_DIR.invariantCatalog}${group}.md`;
			expect(entries.filter((e) => e.file === file).length, file).toBeGreaterThan(10);
		}
	});

	it('no entry outside the baseline runs past the budget', () => {
		const over = entries.filter((e) => isOver(e) && !(keyOf(e) in BASELINE));
		expect(over.map(describeEntry)).toEqual([]);
	});

	it('every baseline entry is still over (delete its row once it fits)', () => {
		const overKeys = new Set(entries.filter(isOver).map(keyOf));
		expect(Object.keys(BASELINE).filter((key) => !overKeys.has(key))).toEqual([]);
	});

	// ── Reader self-tests ───────────────────────────────────────────────────

	const entry = (n: number, width = 10) =>
		['**G9.1 · Name.**', ...Array.from({ length: n - 1 }, () => 'x'.repeat(width))].join('\n');
	const sizes = (markdown: string) =>
		catalogEntries('f.md', markdown).map((e) => [e.id, e.lines, isOver(e)]);

	it('a seven-line entry is over and a six-line one is not', () => {
		expect(sizes(entry(7))).toEqual([['G9.1', 7, true]]);
		expect(sizes(entry(6))).toEqual([['G9.1', 6, false]]);
	});

	it('six long lines are over on characters', () => {
		expect(sizes(entry(6, 99))).toEqual([['G9.1', 6, false]]);
		expect(sizes(entry(6, 130))).toEqual([['G9.1', 6, true]]);
	});

	it('a blank line ends the entry, and CRLF counts the same', () => {
		expect(sizes(`${entry(3)}\n\n- a list\n- after it`)).toEqual([['G9.1', 3, false]]);
		expect(sizes(entry(7).replace(/\n/g, '\r\n'))).toEqual([['G9.1', 7, true]]);
	});

	it('a table row, a heading and a mid-paragraph G-number are not entries', () => {
		const markdown = '| G4.1 | row |\n\n## G4.2 · heading\n\nsee **G4.3 · Name.** here';
		expect(catalogEntries('f.md', markdown)).toEqual([]);
	});
});
