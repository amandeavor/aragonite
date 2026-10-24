// @vitest-environment jsdom
// Every block edit at every offset of every short string over the Markdown alphabet: a typed
// character, a delete either side of the caret (a merge at the leaf's edge), and a split. Each
// must leave the tree a reload of its bytes would build, fire no dev check, and undo to the
// original bytes and redo to the edit.
import { it } from 'vitest';
import type { BlockEditActions } from '#lib/action-contracts.js';
import type { CstNode, Document } from '#lib/core/nodes.js';
import { describeShapeDivergence } from '#lib/core/shape-divergence.js';
import { defaultGrammarView } from '#lib/schema/block-openers.js';
import { readAsOpened } from '#lib/schema/opened-reading.js';
import { serialize } from '#lib/core/serializer.js';
import { getContentRange } from '#lib/core/inline/index.js';
import { trimTrailingLineEnding } from '#lib/core/lines.js';
import { installPlugins } from '#lib/schema/plugin-install.js';
import { createHistoryActions } from '#lib/editor-actions/commit/history.js';
import { describeConvergence } from '#lib/testing/parse-convergence.js';
import { createHeadlessActions } from '#lib/testing/headless-actions.js';
import { createUndoController } from '#lib/editor-actions/commit/undo-controller.js';
import { createBlockEditActions } from '#lib/editor-actions/block-edit.js';
import { endTypingBatchesForTests } from '#lib/editor-actions/commit/text-batch.js';
import { containerBundleOver } from '#lib/test/harness/editor-actions.js';
import { describeRunDivergence } from '#lib/test/harness/parse-converged.js';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';
import { enumerateStrings } from '../gfm-conformance/corpus';
import { ALPHABET_PLUGINS, EDIT_LENGTH, EXHAUSTIVE_ALPHABET } from './alphabet';
import { holdToKnownFailures } from './known-failures';

/** Unspied, unlike the shared harness: a `vi.fn` lives until the file ends, and this file builds
 *  a harness per edit. */
function harnessOver(doc: Document) {
	const { deps } = createHeadlessActions(doc);
	const controller = createUndoController(deps);
	return { deps, controller, blockEdit: createBlockEditActions(deps, controller) };
}

type Harness = ReturnType<typeof harnessOver>;

interface Edit {
	name: string;
	/** Runs the edit; false where it doesn't apply at this offset, so nothing is checked. */
	apply(
		blockEdit: BlockEditActions,
		index: number,
		node: CstNode,
		offset: number
	): Promise<boolean>;
}

const write = (
	blockEdit: BlockEditActions,
	index: number,
	text: string,
	before: number,
	after: number
) => blockEdit.updateBlockContent(index, text, 'authored', 'join-typing', before, after);

const EDITS: Edit[] = [
	...EXHAUSTIVE_ALPHABET.map((char) => ({
		name: `type ${JSON.stringify(char)}`,
		apply: async (blockEdit: BlockEditActions, index: number, node: CstNode, offset: number) => {
			const raw = node.raw;
			await write(
				blockEdit,
				index,
				raw.slice(0, offset) + char + raw.slice(offset),
				offset,
				offset + 1
			);
			return true;
		}
	})),
	{
		name: 'delete before',
		apply: async (blockEdit, index, node, offset) => {
			if (offset === 0) return index > 0 && blockEdit.mergeWithPrevious(index);
			await write(
				blockEdit,
				index,
				node.raw.slice(0, offset - 1) + node.raw.slice(offset),
				offset,
				offset - 1
			);
			return true;
		}
	},
	{
		name: 'delete after',
		apply: async (blockEdit, index, node, offset) => {
			if (offset === trimTrailingLineEnding(node.raw).length) return blockEdit.mergeWithNext(index);
			await write(
				blockEdit,
				index,
				node.raw.slice(0, offset) + node.raw.slice(offset + 1),
				offset,
				offset
			);
			return true;
		}
	},
	{
		name: 'split',
		apply: async (blockEdit, index, node, offset) => {
			const { start, end } = getContentRange(node);
			return offset >= start && offset <= end && blockEdit.splitBlock(index, offset);
		}
	}
];

function leafPaths(nodes: readonly CstNode[], prefix: number[] = []): number[][] {
	return nodes.flatMap((node, i) =>
		node.children ? leafPaths(node.children, [...prefix, i]) : [[...prefix, i]]
	);
}

/** The block-edit bundle that writes the leaf at `path`: the document's, or its container's. */
function blockEditAt(h: Harness, path: number[]): BlockEditActions {
	if (path.length === 1) return h.blockEdit;
	return containerBundleOver(h.deps, h.controller, path.slice(0, -1)).bundle.blockEdit;
}

function leafAt(nodes: readonly CstNode[], path: number[]): CstNode {
	for (const index of path.slice(0, -1)) nodes = nodes[index].children!;
	return nodes[path.at(-1)!];
}

/** `source` the way the editor opens it, a container left empty given a paragraph to type in. */
const opened = (source: string) =>
	readAsOpened(source, { grammar: defaultGrammarView, scope: 'document' });

/** Where the tree differs from the editor opening its bytes. Emptied, the document keeps one
 *  empty paragraph, which no reading of no bytes builds, so the caller skips that case. */
function reloadDivergence(doc: Document, edited: string): string | null {
	const shape = describeShapeDivergence(doc, opened(edited));
	if (shape) return shape;
	// The blank-line check reads with the plain parser, so it runs only where opening the bytes
	// gave no container an empty paragraph.
	return describeConvergence(doc) === null ? describeRunDivergence(doc) : null;
}

/** What went wrong with `edit` at `offset` of the leaf at `path`, dev checks included, or null. */
async function judge(source: string, path: number[], offset: number, edit: Edit) {
	const failure = await editFailure(source, path, offset, edit);
	const fired = [...new Set(takeDevWarns().map((record) => record.tag))];
	if (fired.length === 0) return failure;
	return `${failure ? `${failure}; ` : ''}fired ${fired.join(', ')}`;
}

async function editFailure(source: string, path: number[], offset: number, edit: Edit) {
	const h = harnessOver(opened(source));
	try {
		const leaf = leafAt(h.deps.doc.children, path);
		const applied = await edit.apply(blockEditAt(h, path), path.at(-1)!, leaf, offset);
		if (!applied) return null;
		const edited = serialize(h.deps.doc);
		const diverged = edited === '' ? null : reloadDivergence(h.deps.doc, edited);
		if (diverged) return `${JSON.stringify(edited)} differs from a reload: ${diverged}`;
		const history = createHistoryActions(h.deps, h.controller);
		await history.requestUndo();
		const undone = serialize(h.deps.doc);
		await history.requestRedo();
		const redone = serialize(h.deps.doc);
		if (undone !== source || redone !== edited) {
			return `undo gave ${JSON.stringify(undone)}, redo ${JSON.stringify(redone)}`;
		}
		return null;
	} catch (error) {
		return `threw ${String(error)}`;
	} finally {
		// A typing write arms a pause timer that holds the harness; no timer runs in this loop.
		endTypingBatchesForTests();
	}
}

it(`keeps every block edit at every offset up to length ${EDIT_LENGTH} reading back as a reload`, async () => {
	installPlugins(ALPHABET_PLUGINS());
	const failures: string[] = [];
	for (const source of enumerateStrings(EXHAUSTIVE_ALPHABET, 1, EDIT_LENGTH)) {
		const blocks = opened(source).children;
		for (const path of leafPaths(blocks)) {
			const end = trimTrailingLineEnding(leafAt(blocks, path).raw).length;
			for (let offset = 0; offset <= end; offset++) {
				for (const edit of EDITS) {
					const failure = await judge(source, path, offset, edit);
					if (failure)
						failures.push(`${JSON.stringify(source)} [${path}]@${offset} ${edit.name}: ${failure}`);
				}
			}
		}
	}
	holdToKnownFailures('edits', failures, EDIT_LENGTH);
}, 3_600_000);
