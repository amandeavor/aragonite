/**
 * The commit sequence (`runCommitCeremony`): undo snapshot, copy before write, mutate,
 * rollback on failure. A node shared with an undo snapshot stays read-only until the commit
 * copies it (G1.9). Keystroke batching is in text-batch.ts, the commit over block lists in
 * structural-commit.ts.
 */

import { isDevChecks } from '../../env';
import { tick } from 'svelte';
import type { Document } from '../../core/nodes';
import type { EditorSelection, Landing } from '../../selection/primitives';
import type { LandOptions } from '../../selection/caret-landing';
import type { UndoEntry } from '../../undo/types';
import type { SelectionPoint } from '../../selection/primitives';
import { digestDoc } from '../../invariants/snapshot-integrity';
import { readCurrentSelection } from '../../selection/native-bridge';
import { asDocPath, pathsEqual } from '../../selection/path-math';
import { assertInvariant } from '../../assert';
import { checkLandingIsAValue, readCaretWhereabouts } from '../../invariants/landing-value';
import { beginCommit, endCommit } from '../../invariants/commit-scope';
import { blockNodeAt } from '../../tree-operations/node-primitives';
import { endsOpen } from '../../tree-operations/open-tail';
import { createTextBatch } from './text-batch';
import { createStructuralCommit, type CommitArgs } from './structural-commit';
import { admitsSnapshot, admitsWrite } from './reading-write-gate';
import type { EditorActionsDeps, UndoController } from '../deps';
import type { CommitLanding, HeldLanding, CommitSnapshotArg } from '../../action-contracts';
import { emitCommitError, toEditEvent } from '../../editor-events';
import {
	assertCommitPaths,
	assertCommittedNodes,
	assertKeepsABlock,
	assertLastLineKept,
	assertLineEndingPairsKept,
	assertListMarkerWidths,
	assertReadsBack,
	documentLineEndings,
	assertUndoTopIntegrity
} from '../../invariants/install';
import {
	docByteLength,
	perfEnabled,
	recordSnapshotClone,
	setUndoGauge
} from '../../perf/instruments';

type EntrySelection = UndoEntry['selection'];

/** `announceEdit` speaks a commit's announcement in the editor's edit live region; only the
 *  controller holds it, so nothing but a commit that wrote can speak there. Silent by default. */
export function createUndoController(
	deps: EditorActionsDeps,
	announceEdit: (message: string) => void = () => {}
): UndoController {
	// ── Selection helpers ─────────────────────────────────────────────────────

	function collapsedSelectionAt(blockIndex: number, offset: number): EditorSelection {
		const point: SelectionPoint = { path: [blockIndex], offset };
		return { anchor: point, focus: point };
	}

	function collapsedSelectionAtPath(path: number[], offset: number): EditorSelection {
		const point: SelectionPoint = { path: path.slice(), offset };
		return { anchor: point, focus: point };
	}

	// ── Snapshot pushers ─────────────────────────────────────────────────────

	/** Snapshots share the live tree's nodes and copy only the top-level children array, so an
	 *  edit copies the path it writes first (G1.9, `tree-operations/unshare.ts`). */
	function shareSnapshot(): Pick<UndoEntry, 'snapshot' | 'integrity'> {
		deps.sharing.markSnapshotTaken();
		const snapshot: Document = {
			kind: 'document',
			prefix: deps.doc.prefix,
			children: [...deps.doc.children],
			suffix: deps.doc.suffix
		};
		return { snapshot, integrity: isDevChecks() ? digestDoc(snapshot) : undefined };
	}

	function recordSnapshotPerf(): void {
		if (!perfEnabled()) return;
		recordSnapshotClone(docByteLength(deps.doc));
		const undo = deps.undoManager.getStacks().undo;
		let liveBytes = 0;
		for (const entry of undo) liveBytes += docByteLength(entry.snapshot);
		setUndoGauge(liveBytes, undo.length);
	}

	const readLive = () => readCurrentSelection(deps.selectionState, deps.blockRefs);

	/**
	 * What an entry records as "where the caret was". The gap caret outranks only the caller's
	 * fallback, since no block ref reports it.
	 */
	function entrySelection(fallback: () => EditorSelection): EntrySelection {
		const live = readLive();
		if (live) return live;
		const gap = deps.selectionState.gapCaret;
		return gap ? { gapCaret: gap } : fallback();
	}

	// ── Undo steps ───────────────────────────────────────────────────────────

	// The outermost open step owns these; a step inside a step adds only depth. The entry is held
	// by identity: a first write that rolls back removes it, and the next write opens it again.
	let stepDepth = 0;
	let stepEntry: UndoEntry | null = null;
	// Read when the step opens, since a gesture may collapse its range before its first write.
	let stepSelection: EntrySelection | null = null;
	let stepPushed = false;
	// Set by the author's input while a step is open; until it closes, writes push alone.
	let stepEnded = false;
	// The entry the typing batch's first keystroke went into, and whether a keystroke's own
	// commit is being called, which joins it.
	let typingEntry: UndoEntry | null = null;
	let joiningTyping = false;
	// The entry the newest commit wrote (null when it was refused), and the one the next typing
	// write joins instead of pushing its own, until a composition or the typing batch ends.
	let lastCommitEntry: UndoEntry | null = null;
	let continued: UndoEntry | null = null;

	const inOpenStep = () => stepDepth > 0 && !stepEnded;
	const isTop = (entry: UndoEntry | null) =>
		entry !== null && deps.undoManager.peekUndo() === entry;

	const joinsStep = () => inOpenStep() && isTop(stepEntry);
	const isJoinedPush = () => (joiningTyping && isTop(typingEntry)) || joinsStep();

	function pushEntry(entry: UndoEntry): void {
		continued = null;
		deps.undoManager.push(entry);
		if (inOpenStep()) {
			stepEntry = entry;
			stepPushed = true;
		}
		recordSnapshotPerf();
	}

	/** The selection a push records: the open step's, else the push's own. */
	function selectionFor(own: () => EntrySelection): EntrySelection {
		return inOpenStep() && stepSelection ? stepSelection : own();
	}

	async function undoStep(seed: CommitSnapshotArg, run: () => Promise<unknown>): Promise<void> {
		// A step opened after the author's input is a new gesture, so it groups its own writes.
		if (stepDepth === 0 || stepEnded) {
			stepEntry = null;
			stepSelection = entrySelection(() => collapsedSelectionAtPath(seed.path, seed.offset));
			stepEnded = false;
		}
		stepDepth++;
		try {
			await run();
		} finally {
			stepDepth--;
			if (stepDepth === 0) {
				// The next keystroke starts its own entry rather than joining the gesture's.
				if (stepPushed && !stepEnded) textBatch.interrupt();
				stepEntry = null;
				stepSelection = null;
				stepPushed = false;
				stepEnded = false;
			}
		}
	}

	// Synchronous: a commit pushes as it is called, so this covers the call, not the awaited tail.
	// Safe because `updateBlockContent` pushes the keystroke's batch entry before its commit.
	function joinTypingBatch<T>(write: () => T): T {
		const outer = joiningTyping;
		joiningTyping = true;
		try {
			return write();
		} finally {
			joiningTyping = outer;
		}
	}

	function endUndoStep(): void {
		if (stepDepth === 0) return;
		stepEnded = true;
		stepEntry = null;
	}

	function continueTypingBurst(): void {
		continued = lastCommitEntry;
	}

	// ── Entry pushes ─────────────────────────────────────────────────────────

	// A push inside a step after its first returns before the snapshot, so it neither marks the
	// tree shared nor clears the redo stack.
	function pushCommitSnapshot(fallbackPath: number[], offset: number): void {
		if (isJoinedPush() || !admitsSnapshot(deps)) return;
		pushEntry({
			...shareSnapshot(),
			blockIds: [...deps.blockIds],
			selection: selectionFor(() =>
				entrySelection(() => collapsedSelectionAtPath(fallbackPath, offset))
			)
		});
	}

	// Path from the live focused leaf, offset from the caller: the live caret is already
	// past the edit, but its path still points at the same leaf.
	function pushTypingSnapshot(leafPath: number[], offset: number): void {
		const joins = continued;
		continued = null;
		if (isTop(joins)) {
			typingEntry = joins;
			return;
		}
		if (joinsStep()) {
			typingEntry = stepEntry;
			return;
		}
		const selection = selectionFor(() => {
			const live = readLive();
			const liveIsCollapsed =
				!!live &&
				pathsEqual(live.anchor.path, live.focus.path) &&
				live.anchor.offset === live.focus.offset;
			return liveIsCollapsed
				? collapsedSelectionAtPath(live.anchor.path, offset)
				: collapsedSelectionAtPath(leafPath, offset);
		});
		const entry = { ...shareSnapshot(), blockIds: [...deps.blockIds], selection };
		pushEntry(entry);
		typingEntry = entry;
	}

	const textBatch = createTextBatch({
		pushSnapshot: pushTypingSnapshot,
		onEnd: () => {
			continued = null;
		}
	});

	// ── Internal commit primitive ────────────────────────────────────────────

	interface RollbackFrame {
		restore(): void;
	}

	/** Everything a commit that throws or bails on discardIfNoop restores; the scopes' state exists
	 *  only once `mutate` has copied it, so restore() hands that to `rollback`. */
	function captureRollbackFrame(args: CommitArgs, pushes: boolean): RollbackFrame {
		// A whole-stack restore, not a pop: the push may evict the oldest entry at the cap. A
		// commit that joins its step's entry pushes nothing, so it has no stacks to restore.
		const savedStacks = pushes ? deps.undoManager.getStacks() : null;
		// The trailing-line fix-up can consume the document's suffix, which no scope holds.
		const savedDocSuffix = deps.doc.suffix;
		return {
			restore() {
				if (savedStacks) deps.undoManager.restoreStacks(savedStacks);
				deps.doc.suffix = savedDocSuffix;
				args.rollback();
			}
		};
	}

	/** The one path to the `error` event, so every throw site reports alike (`docs/design/editor.md` § The event channel). */
	function reportCommitError(args: CommitArgs, error: unknown): void {
		emitCommitError(deps.events, { error, op: args.op?.kind, path: args.op?.eventPath });
	}

	/** `discarded` is a `discardIfNoop` commit that changed nothing: no write, but it still lands. */
	type CommitOutcome = 'written' | 'discarded' | 'failed';

	function runCommitCeremony(args: CommitArgs): CommitOutcome {
		deps.caretMemory.forget();
		textBatch.interrupt();

		if (isDevChecks()) {
			// Both declared paths must be document-absolute; `invariants` imports nothing at
			// runtime, so the number[] to DocPath conversion lives here.
			assertCommitPaths(
				deps.doc,
				asDocPath(args.snapshot.path),
				args.op?.eventPath ? asDocPath(args.op.eventPath) : null
			);
		}

		// Outside the try: the stacks must be saved before the push below.
		const rollback = captureRollbackFrame(args, !isJoinedPush());

		// A `discardIfNoop` commit that changed nothing takes the throw path's restore minus
		// the error event.
		let discarded = false;
		try {
			// Inside the try: readCurrentSelection walks live block refs, plugin leaves included,
			// so it can throw like every other step.
			pushCommitSnapshot(args.snapshot.path, args.snapshot.offset);
			lastCommitEntry = deps.undoManager.peekUndo() ?? null;
			const wasOpen = endsOpen(deps.doc);
			const endings = documentLineEndings(deps.doc);
			const changed = args.mutate(wasOpen);
			if (args.discardIfNoop && !changed) {
				// The mutation ran but no scope changed: unwind as a throw would.
				rollback.restore();
				discarded = true;
			} else if (isDevChecks()) {
				const written = args.written();
				assertCommittedNodes(written.nodes, deps.reading.grammar);
				assertLastLineKept(deps.doc, wasOpen);
				assertLineEndingPairsKept(deps.doc, endings);
				assertKeepsABlock(deps.doc, written.nodes);
				assertReadsBack(written.tops, deps.reading.grammar);
				assertListMarkerWidths(written.tops);
			}
			if (!discarded && isDevChecks()) {
				// A missed copy before write corrupts the newest undo entry, so the commit catches it
				// rather than some distant undo (G1.9). Never throws.
				assertUndoTopIntegrity(deps.undoManager.peekUndo() ?? undefined);
			}
		} catch (err) {
			rollback.restore();
			reportCommitError(args, err);
			// Loud in dev; production swallows it so one failed edit does not kill the editor.
			// The tree is intact either way: rolled back, or never installed.
			if (isDevChecks()) throw err;
			return 'failed';
		}

		if (!discarded) {
			// After the result is installed, so nothing caches the new version against a
			// half-installed tree; a discarded commit rolled back, so it announces nothing.
			deps.bumpContentVersion();
			// A commit moves what the gap caret's boundary index names, and nothing can say which
			// boundary the user meant; after the push, so the stored entry keeps the gap.
			deps.selectionState.clearGapCaret();
		}

		if (!discarded && args.op) {
			deps.events.emit('edit', toEditEvent(args.op, args.op.eventPath, Date.now()));
		}

		return discarded ? 'discarded' : 'written';
	}

	/** The commit's landing, checked in dev to have moved no caret while it was read. */
	function readLanding(landing: CommitLanding | undefined): Landing | null {
		if (!landing) return null;
		if (!isDevChecks()) return landing();
		const before = readCaretWhereabouts();
		const value = landing();
		assertInvariant('landing-is-a-value', () =>
			checkLandingIsAValue(before, readCaretWhereabouts())
		);
		return value;
	}

	// Bracket the synchronous commit so the decorations never read a half-applied tree.
	// Cleared before the first await. Resolves to whether bytes landed.
	async function __commit(args: CommitArgs): Promise<boolean> {
		const op = args.op?.kind ?? args.entry;
		const target = args.op?.eventPath ?? args.snapshot.path;
		lastCommitEntry = null;
		// A refused write lands nothing, while a discarded no-op still lands: whether a commit
		// lands is its own question, not whether it wrote.
		if (!admitsWrite(deps, op, () => blockNodeAt(deps.doc, target)?.kind)) return false;
		// Read before any await, so an undo or swap during the landing's mount makes it give up.
		const stamp = deps.caretLanding.generation();
		beginCommit();
		let outcome: CommitOutcome;
		try {
			outcome = runCommitCeremony(args);
		} finally {
			endCommit();
		}
		if (outcome === 'failed') return false;
		await tick();
		// Awaited, so the promise every caller holds means "the caret is placed". No rollback on a
		// throw: the commit succeeded and the tree is correct, so it is reported and the next runs.
		try {
			const landing = readLanding(args.landing);
			const placement = landing && placementOf(args, landing, stamp);
			if (placement && heldDepth > 0) held = placement;
			else if (placement) await placement.place();
		} catch (err) {
			reportCommitError(args, err);
		}
		if (outcome !== 'written') return false;
		if (args.announce) announceEdit(args.announce());
		return true;
	}

	function placementOf(args: CommitArgs, landing: Landing, stamp: number): HeldLanding {
		const opts: LandOptions = { stamp, reveal: args.reveal };
		return {
			async place() {
				try {
					if ('anchor' in landing) await deps.caretLanding.restore(landing, opts);
					else await deps.caretLanding.land(landing, opts);
				} catch (err) {
					reportCommitError(args, err);
				}
			}
		};
	}

	// ── Held landings ────────────────────────────────────────────────────────

	// While a hold runs, a commit keeps its caret here instead of putting it down; the newest wins.
	let heldDepth = 0;
	let held: HeldLanding | null = null;

	async function holdLandings<T>(run: () => Promise<T>): Promise<[T, HeldLanding | null]> {
		const outer = held;
		held = null;
		heldDepth++;
		try {
			const result = await run();
			return [result, held];
		} finally {
			heldDepth--;
			held = outer;
		}
	}

	const { commitStructural, commitContainerStructural, commitMultiScope, getDocScope } =
		createStructuralCommit(deps, __commit);

	// ── State capture / checkpoint control ──────────────────────────────────

	function captureCurrentState(): UndoEntry {
		// The same selection read as the snapshot pushes: this is the entry an undo or redo
		// pushes onto the opposite stack, so a gap caret or a selected image's caret survives.
		return {
			...shareSnapshot(),
			blockIds: [...deps.blockIds],
			// Fallback when nothing is focused (a headless harness, a programmatic capture).
			selection: entrySelection(() => collapsedSelectionAt(0, 0))
		};
	}

	return {
		pushUndoSnapshotDebounced: (leafPath, offset, batchKey) => {
			if (admitsSnapshot(deps)) textBatch.keystroke(leafPath, offset, batchKey);
		},
		armUndoPause: textBatch.armPause,
		commitStructural,
		commitContainerStructural,
		commitMultiScope,
		getDocScope,
		captureCurrentState,
		flushDebouncedCheckpoint: textBatch.interrupt,
		undoStep,
		joinTypingBatch,
		endUndoStep,
		continueTypingBurst,
		endContinuedBurst: () => {
			continued = null;
		},
		holdLandings,
		// The snapshot's answer is the write gate's, with no warning.
		admitsGesture: (op) => (op === null ? admitsSnapshot(deps) : admitsWrite(deps, op)),
		isolateUndoEntry: (write) => {
			// Both sides: the first break makes the write push its own snapshot instead of
			// joining the burst before it, the second keeps the next keystroke out of it.
			textBatch.interrupt();
			write();
			textBatch.interrupt();
		}
	};
}
