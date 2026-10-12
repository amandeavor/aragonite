/**
 * Bytes read the way the editor opens a file: parsed, then every container that must hold a child
 * given an empty paragraph to type in. Whatever turns bytes into nodes the editor holds, or
 * compares the editor's tree with a reload, reads through here.
 */

import { makeBlockNode, type CstNode, type Document } from '../core/nodes';
import { readBlocks } from '../core/parser';
import {
	documentLineEnding,
	ownTrailingLineEnding,
	trailingLineEnding,
	type LineEnding
} from '../core/lines';
import { mustHoldChild } from './block-kind-descriptor';
import { reservedChromeKindOf } from './reserved-chrome';

/** `source` as the editor opens it; the tree a reload shows. */
export function readAsOpened(
	source: string,
	read: Parameters<typeof readBlocks>[1],
	filled?: CstNode[]
): Document {
	const doc = readBlocks(source, read);
	const ending = documentLineEnding(doc);
	for (const child of doc.children) ensureEditableContainers(child, ending, filled);
	return doc;
}

/** Gives every container under `node` that must hold a child an empty paragraph, so the caret
 *  always has a target, and lists each one in `filled`, since a write must rebuild its bytes. */
export function ensureEditableContainers(
	node: CstNode,
	ending: LineEnding,
	filled?: CstNode[]
): void {
	if (!node.children) return;
	if (node.children.length === 0 && mustHoldChild(node.kind)) {
		filled?.push(node);
		const chromeKind = reservedChromeKindOf(node.kind);
		const lineEnding = trailingLineEnding(node.raw, ending);
		// A container with a reserved title child re-creates that child too, or the backfilled
		// paragraph would occupy its position (G1.14).
		if (chromeKind !== undefined) {
			node.children.push(makeBlockNode({ kind: chromeKind, leadingTrivia: '', raw: lineEnding }));
		}
		// The paragraph holds the container's last line, so an open last line stays open in it.
		const lastLineEnding = node.raw === '' ? lineEnding : ownTrailingLineEnding(node.raw);
		node.children.push({ kind: 'paragraph', leadingTrivia: '', raw: lastLineEnding });
		// The synthesized paragraph's ending already represents the blank `parseBlocks`
		// routed into innerPrefix; keeping both double-counts the line on rebuild.
		node.innerPrefix = '';
	}
	for (const child of node.children) {
		ensureEditableContainers(child, ending, filled);
	}
}
