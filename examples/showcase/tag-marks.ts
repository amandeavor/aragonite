/**
 * Tags inside the text as a mark decoration over ordinary characters, not an inline widget, plus a
 * `#` autocomplete over the tags the document already holds. A tag's source is what it shows, so
 * the caret walks straight through it. The editor is typed by shape rather than imported, so the
 * Svelte showcase (repo source) and the framework showcases (the installed package) share one copy.
 */

import { isTagOpening, isTagQuery, recognizeTag } from './tag-scan';

export const TAG_MARK_CLASS = 'body-tag-mark';
export const TAG_MENU = 'harness-tags';

/** Adds the tag decorations and the tag menu to one editor; call it from a plugin's `onEditor`
 *  and return what it returns, which removes both. */
export function installTagMarks(editor: TagEditor): () => void {
	const marks = editor.decorations.addSource({
		name: 'harness-tag-marks',
		provide: (doc) => tagMarks(doc)
	});
	// The editor owns the session: it notices the typed `#`, holds the arrow keys, and writes the
	// pick as one undo entry.
	const menu = editor.inlineMenus.addSource({
		name: TAG_MENU,
		trigger: '#',
		opensAt: isTagOpening,
		accepts: isTagQuery,
		items: ({ query, path, start }) => tagItems(editor.document, query, path, start)
	});
	return () => {
		marks.dispose();
		menu.dispose();
	};
}

// ── The editor, as far as the tags use it ───────────────────────────────────

interface TagNode {
	readonly raw: string;
	readonly children?: readonly TagNode[];
}

interface TagDocument {
	readonly children: readonly TagNode[];
}

interface TagMark {
	type: 'mark';
	path: number[];
	start: number;
	end: number;
	class: string;
	attrs: Record<string, string>;
}

interface TagMenuItem {
	id: string;
	label: string;
	detail: string;
	insert: string;
}

interface TagEditor {
	readonly document: TagDocument;
	decorations: {
		addSource(source: { name: string; provide: (doc: TagDocument) => TagMark[] }): Disposable;
	};
	inlineMenus: {
		addSource(source: {
			name: string;
			trigger: string;
			opensAt(raw: string, pos: number): boolean;
			accepts(query: string): boolean;
			items(query: { query: string; path: readonly number[]; start: number }): TagMenuItem[];
		}): Disposable;
	};
}

interface Disposable {
	dispose(): void;
}

// ── Internal ────────────────────────────────────────────────────────────────

function tagMarks(doc: TagDocument): TagMark[] {
	const marks: TagMark[] = [];
	forEachLeaf(doc.children, (node, path) => {
		const raw = node.raw;
		for (let i = raw.indexOf('#'); i !== -1; i = raw.indexOf('#', i + 1)) {
			const span = recognizeTag(raw, i, raw.length);
			if (!span) continue;
			marks.push({
				type: 'mark',
				path,
				start: span.start,
				end: span.end,
				class: TAG_MARK_CLASS,
				attrs: { 'data-tag': span.name }
			});
			i = span.end - 1;
		}
	});
	return marks;
}

/** The document's other tags that start with the query, most used first. The tag under the caret
 *  is left out of the count: it is the query, not a suggestion. */
function tagItems(
	doc: TagDocument,
	query: string,
	at: readonly number[],
	start: number
): TagMenuItem[] {
	const counts = new Map<string, number>();
	const here = at.join();
	forEachLeaf(doc.children, (node, path) => {
		const raw = node.raw;
		for (let i = raw.indexOf('#'); i !== -1; i = raw.indexOf('#', i + 1)) {
			const span = recognizeTag(raw, i, raw.length);
			if (!span) continue;
			if (!(i === start && path.join() === here)) {
				counts.set(span.name, (counts.get(span.name) ?? 0) + 1);
			}
			i = span.end - 1;
		}
	});
	const wanted = query.toLowerCase();
	return [...counts]
		.filter(([name]) => name.toLowerCase().startsWith(wanted) && name !== query)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, 8)
		.map(([name, count]) => ({
			id: name,
			label: `#${name}`,
			detail: String(count),
			insert: `#${name}`
		}));
}

function forEachLeaf(
	children: readonly TagNode[],
	visit: (leaf: TagNode, path: number[]) => void,
	basePath: number[] = []
): void {
	children.forEach((node, index) => {
		const path = [...basePath, index];
		if (node.children && node.children.length > 0) forEachLeaf(node.children, visit, path);
		else visit(node, path);
	});
}
