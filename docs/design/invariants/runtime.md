# Group 1: runtime checked

The words this catalog leans on, and what the enforcement levels mean, are in [the index](../invariants.md).

These checks run in three kinds of place:

- **The commit primitive**: `invariants/install.ts :: assertCommittedNodes`, invoked from
  `editor-actions/commit/undo-controller.ts` after each commit's raw rebuild. Anything shaped like
  "a committed node is coherent" runs here.
- **Bootstrap**: the registration-check flush (`schema/registration-checks.ts`), first at Editor
  mount via `runStartupInvariantChecks`, then at the next mount or grammar read
  (`getOrderedOpeners`), never mid-batch, so forward references inside one registration batch stay
  quiet. Registry completeness (G1.2) checks built-ins only, the one closed set of kinds.
- **Its own machinery**: the guard fires inside the code it protects. One exception: G1.33 fires in
  the editor root's focus handler (`components/editor-root/focus.ts`), above every caret entry, so a
  consumer's own caret component inherits it.

| ID     | What stays true                                                                            | Codes   |
| ------ | ------------------------------------------------------------------------------------------ | ------- |
| G1.1   | A strip container's raw and metadata never go stale against its children and bytes         | A·P·N·D |
| G1.2   | Every built-in block kind has a descriptor (its view moved up to G3.15)                    | A·P     |
| G1.3   | _Retired upward_: container-iff-rebuildRaw is now unrepresentable                          | T       |
| G1.4   | No container publishes the undo-history context key                                        | A·L·N   |
| G1.5   | Leaf fields on leaves, container fields on containers                                      | A·P·N   |
| G1.6   | `cloneMetadata` hands back a genuinely independent copy                                    | A·P     |
| G1.7   | Metadata writes that drive raw go through `updateBlockMetadata`                            | A·N     |
| G1.8   | `getContentRange` is well-formed for every kind that has one                               | A·P·N   |
| G1.9   | No mutation writes bytes through a node an undo entry shares                               | T·A·P·N |
| G1.10  | Opener priorities are unique (an opener's kind always has a descriptor now)                | A·N     |
| G1.11  | Every keymap chord is unique per kind and names a known command                            | A·N     |
| G1.12  | An opaque container's raw still reparses to its live children and metadata                 | A·N     |
| G1.13  | An opaque `rebuildRaw` is deterministic over committed state                               | A·N     |
| G1.14  | A container declaring `reservedChrome` holds its chrome leaf at child 0                    | A·N     |
| G1.15  | A plugin opener claims at least one line, and its raw matches the lines it consumed        | A·N     |
| G1.16  | Every coordinate a commit declares is document-absolute                                    | A·N     |
| G1.17  | An opener registered after the grammar was read warns                                      | A·N     |
| G1.18  | A container's `reservedChrome` names a registered chrome kind                              | A·N     |
| G1.19  | A commit scope's declared path still resolves to its captured node                         | A       |
| G1.20  | An unshared chain is as deep as the path it was asked for                                  | A       |
| G1.21  | A column edit's row scopes are the owned table's own children                              | A       |
| G1.22  | Every index on an unshare path addresses a live child                                      | A       |
| G1.23  | Decoration sources never run mid-commit                                                    | A       |
| G1.24  | A kind's closure block agrees with the rest of its descriptor                              | A·N     |
| G1.25  | Widget-pool acquires happen only inside an open render pass                                | A·N     |
| G1.26  | A fold implies an active reveal, and an open reveal blocks command mutation                | A·N     |
| G1.27  | `compositionend` lands only inside a composition the surface opened                        | A·N     |
| G1.28  | A code block's render and a painted leaf source carry the block's bytes exactly            | A·N     |
| G1.29  | A selection endpoint's offset means what its own block's coordinate space says             | A·N     |
| G1.30  | Every registered kind declares a `mergeRole` from the known set                            | A·N     |
| G1.31  | The inline-construct policy table is coherent and unambiguous                              | A·N     |
| G1.32  | _Retired upward_: a content-start Backspace with no range no longer compiles               | T       |
| G1.33  | A block the caret is placed in paints at least one position a caret can land on            | A·N     |
| G1.34  | _Retired_: a split's landing reads the index `splitNode` returned (G4.43)                  | L       |
| G1.35  | A slot that holds exactly one node never takes bytes that reparse to several               | A·N     |
| G1.36  | A structural change fits the arrays it syncs; ids stay in lockstep with children           | A·N     |
| G1.37  | _Retired upward_: a context-dependent kind with an opener no longer compiles               | T       |
| G1.38  | A spliced container raw equals what a full rebuild would write                             | A·P·N   |
| G1.39  | At most one caret the editor draws shows at a time                                         | L       |
| G1.40  | Every built-in kind declares its page role and its height estimate                         | A·N     |
| G1.41  | A structural edit keeps the final break as it was (a blank last line keeps its own)        | A·P·N   |
| G1.42  | A list item's checkbox and blocks are what its reload reads                                | A·N     |
| G1.43  | Reading a commit's landing moves no caret                                                  | A·N     |
| G1.44  | The document holds a block, and a commit leaves no container it touched empty              | A·N     |
| G1.45  | A caret landing's focus scrolls nothing                                                    | A·N     |
| G1.46  | A caret or range the editor puts down leaves no widget selected whole                      | A·N     |
| G1.47  | A windowed child measures into its own block list                                          | A·N     |
| G1.52  | The text `getSource()` serves for an unchanged content version is the document             | A·N     |
| G1.53  | _Retired_: a stale write is refused quietly at the write gate, with nothing left to assert | none    |
| G1.54  | A commit's mutation leaves the tree's own top-level array as it found it                   | A·N     |
| G1.55  | A top-level block an edit wrote reads back, on its own, as the tree it holds               | A·N     |
| G1.58  | An indent key over a range keeps every word it holds, in order                             | A·N     |
| G1.61  | A list move keeps the order its text reads in                                              | A·P·N   |
| G1.71  | A command key over a range runs in the kind of block whose keymap claimed it               | A·N     |
| G1.75  | No selection endpoint the editor writes sits after an empty block's placeholder `<br>`     | A·N     |
| G1.76  | The drawn caret sits on its caret until the caret moves                                    | A       |
| G1.77  | The mark hiding the browser's caret is on exactly the editable the drawn caret draws for   | A       |
| G1.87  | Nothing an editor started before it unmounted writes, reports or reads its tree after      | N       |
| G1.90  | A plugin component compiled against another Svelte runtime is named as such in dev         | N       |
| G1.91  | A live removal keeps the marks on the visible characters it keeps                          | P·N     |
| G1.94  | One editor per mount target: a second `createEditor` there before `destroy` warns in dev   | A       |
| G1.96  | A plugin's widget, decoration or row view mounts once, updates in place, is destroyed once | N       |
| G1.97  | A value a Vue app holds in reactive state reaches the editor unwrapped                     | harness |
| G1.99  | A styled editor resolves the host colors, from the theme stylesheet or the page            | A       |
| G1.104 | A plugin registers only from its `definePlugin` setup                                      | N       |
| G1.106 | A range delete takes whole rows from a table it keeps an edge of                           | A·N     |
| G1.110 | A metadata write to a leaf is refused, since a leaf's metadata comes from its bytes        | A·N     |
| G1.112 | A content write inside a commit leaves its fix-up to the commit                            | A·N     |
| G1.113 | A list item's drawn marker is its own opening bytes                                        | A·P     |
| G1.115 | A caret restored inside a widget that can show its source opens the source at that byte    | A·N     |
| G1.117 | A write never splits a CRLF pair into a lone `\r` or a lone `\n`                           | A·N     |
| G1.118 | A list's marker-width counts are what a recount of its items gives                         | A·N     |
| G1.119 | No caret the editor writes sits between a CRLF pair's `\r` and `\n`                        | A·N     |

### The entries

**G1.1 · Container raw not stale.** A strip container's bytes, reparsed, come back as a single block
whose stripped inner bytes equal `serialize(children)`, and every strip container's metadata (this
one's and each nested one's) is what that reparse gives it, through the compare G1.12 uses
(`metadata-parity.ts`). The check is byte-level on purpose: an empty container's placeholder
paragraph and the parser's trailing-blank trivia serialize the same, so don't re-tighten it to a
structural tree compare, which false-fires on every empty list item and trailing blank `>` line. A
metadata key no reparse would give (one written through `updateBlockMetadata` for its own sake)
fires too. Non-strip containers are exempt, grid outright and opaque via G1.12 and G1.13. Predicate
`checkStaleRaw` (`node-shape.ts`) · commit primitive · `stale-raw.test.ts`,
`strip-stale-metadata.test.ts`.

**G1.2 · Registry completeness.** Every `BlockKind` resolves to a descriptor, the kinds enumerated
from the union-derived manifest (`core/nodes.ts :: BLOCK_KIND_TABLE`, `ALL_BLOCK_KINDS`). Predicate
`checkRegistryCompleteness` (`registry.ts`) · bootstrap · `registry.test.ts`. The rule used to say
"and a component" too; that half retired upward to G3.15, whose table type makes a built-in with
no view a compile error.

**G1.3 · Retired upward.** The rule was: `isContainer` iff `rebuildRaw`. The grouped registration
shape (G3.6) derives `isContainer` from the `container` group, whose `rebuildRaw` is required, so
the pairing violation became unrepresentable, and the runtime guard and its tests are deleted.
Superseded by G3.6 (`BlockKindRegistration`).

**G1.4 · No container history context.** No container `setContext`s `HISTORY_KEY`. Predicate
`checkNoContainerHistoryKey` (`context-keys.ts`) · run in
`editor-actions/nested/nested-actions.ts :: setNestedActionsContexts` · `context-keys.test.ts`,
`lint/file-rules.test.ts`.

**G1.5 · Category and field legality.** Leaf fields appear only on leaves, container fields only on
containers, and a wrap-less container carries no `innerPrefix`. Predicate `checkCategoryFields`
(`node-shape.ts`) · commit primitive · `category-fields.test.ts`.

**G1.6 · Clone-safe metadata.** A kind's `cloneMetadata` returns a copy that's safe to mutate
independently, checked at both places a node is copied: `tree-operations/clone.ts :: cloneNode` and
`tree-operations/unshare.ts :: copyNode`. Predicate `checkCloneSafeMetadata` (`node-shape.ts`) ·
`clone-safe-metadata.test.ts`.

**G1.7 · Metadata writes route through `updateBlockMetadata`.** No predicate of its own; the rule is
enforced by routing. `editor-actions/block-edit-core.ts :: updateBlockMetadata` rebuilds raw after
the merge, and both factories delegate to the shared core, so metadata and bytes can't drift apart.
A leaf has no rebuild, so the core refuses it (G1.110). G1.1 is the runtime backstop for a bypass. Test `test/editor-actions/update-block-metadata.test.ts`.

**G1.8 · Well-formed content ranges.** `getContentRange` is well-formed for every kind that has one:
the prose kinds, plus any non-prose kind declaring its own (the directive leaf does), because the
range is consumed without asking `supportsInline` first. Predicate `checkContentRange`
(`descriptor.ts`) · commit primitive · `descriptor.test.ts`.

**G1.9 · Snapshot aliasing.** No mutation writes serialized bytes through a node an undo/redo entry
shares; moving a shared node within the live tree is fine. Most of the rule is a type: readers and
plugins hold bytes-readonly views (`core/node-views.ts`, G3.8), and G4.13 guards the casts that
would strip one. A writer copies the path first and re-reads the copy through the `$state` tree
(the header of `tree-operations/unshare.ts` has the full statement). The table rebuild is the one
container rebuild that writes its children's bytes, and only to a row an edit already copied. The
DEV check stays because runtime JS bypasses types; its digest hashes every node's bytes, not just
the top-level ones. Predicate `checkSnapshotIntegrity` (`snapshot-integrity.ts`) · commit primitive
(top undo entry) plus undo/redo restore (`editor-actions/commit/history.ts`) ·
`snapshot-integrity.test.ts`, `test/undo/undo-restoration.property.test.ts`.

The **commit-rollback companion** lives here too: a commit mutation that throws leaves the undo/redo
stacks byte-identical to before (restored through `UndoManager.restoreStacks`) and publishes no
partial tree, emits `error{origin:'commit'}`, then re-throws in DEV and swallows in production. The
tree comes back because the commit keeps the top-level array it started from, and copy-path-on-write
leaves that array reaching an intact tree. A container scope already copied earlier in the same
undo step gets no fresh copy, so the commit also saves each container scope's children and child-id
arrays and puts them back on a throw. One residual is open by design: in such a scope, a byte write
deeper than an owned node's direct children, metadata below them, or a byte write to a top-level
block the undo step already owns stays written after a throw. Only an internal malformed-change bug
reaches it, and DEV re-throws. Covered by
`test/editor-actions/commit/commit-rollback.test.ts` and `commit-rollback-bytes.test.ts`.

**G1.10 · Unique opener priorities.** No two openers share a priority: a tie still dispatches by
kind name, but it's almost always a mistake. The rule used to say every opener's kind has a
descriptor too; an opener is now a field of the kind's registration, so that half can't be written.
Predicate `checkOpenerRegistry` (`registry.ts`) · bootstrap · `opener-registry.test.ts`.

**G1.11 · Keymap coherence.** Every keymap chord names a known command id, and chords are unique
per kind. A malformed chord throws earlier, at `registerBlockKind` or `augmentBlockKind`, in every
build; the command check waits for bootstrap because a plugin can register its kind before the
command its keymap binds. Predicate `checkKeymapCoherence` (`registry.ts`) · bootstrap ·
`keymap-coherence.test.ts`.

**G1.12 · Opaque container raw not stale.** An opaque container's raw reparses to children that
byte-match the live ones (chrome compared by position for `reservedChrome` declarers), and every
metadata key matches the reparse through `metadata-parity.ts`, so a rebuild route that skips the
re-read fires at the next commit that checks the container. When the raw no longer reparses to one
block of its own kind, a kind with a recognizer of its own (an opener, or a directive) fires, and a
kind with none is skipped. Predicate `checkOpaqueStaleRaw` (`node-shape.ts`) · commit primitive ·
`opaque-contract.test.ts`, `opaque-stale-raw-directive.test.ts`, `opaque-stale-metadata.test.ts`.

**G1.13 · Opaque rebuild determinism.** `rebuildRaw` is deterministic over committed state, checked
probe-vs-probe: run it twice, require the same bytes. Predicate `checkOpaqueRebuildDeterminism`
(`node-shape.ts`) · commit primitive · `opaque-rebuild-determinism.test.ts`.

**G1.14 · Reserved-chrome slot.** A container declaring `reservedChrome` holds a chrome leaf of the
declared kind at child 0; kinds with no declaration are exempt. Predicate `checkReservedChromeSlot`
(`node-shape.ts`) · commit primitive · `reserved-chrome-slot.test.ts`.

**G1.15 · Opener return trust.** A plugin opener claims at least one line (`consumed >= 1`). A
return claiming none is **declined in every build** (the line falls through to the next opener) and
warns `opener-advance`. The returned `node.raw` must byte-match the consumed lines, else
`opener-raw` warns, since serialize reads `raw` only and the drift breaks round-trip. Inline guards,
module-private to `core/parser.ts`, driven through `parse()` in
`test/core/parser-opener-guards.test.ts`.

**G1.16 · Commit paths are document-absolute** (`commit-path-dialect`). Every coordinate a commit
declares (`op.eventPath`, `snapshot.path`) resolves from the document root, prefix by prefix; the
final index may name the one-past-end insert slot (append-shaped ops). Predicate
`checkCommitPathAddressable` (`commit-paths.ts`) · commit primitive, before the mutation, via
`invariants/install.ts :: assertCommitPaths` · `commit-paths.test.ts`.

**G1.17 · No late opener.** A kind registered with an opener after the grammar was read warns:
parsed documents never re-parse, so the kind would miss every open document. Register before the
first editor mounts. Predicate `checkLateOpenerRegistration` (`registry.ts`) · bootstrap ·
`test/schema/registration-checks.test.ts`.

**G1.18 · Reserved-chrome coherence.** The chrome kind a container's `reservedChrome` names (its
title row) is registered, which `registerChromeLeaf` does, and a registered kind always carries its
view (G3.15, which retired this check's component half). The bootstrap counterpart to G1.14's
per-commit slot check. Predicate `checkReservedChromeCoherence`
(`registry.ts`) · bootstrap · `reserved-chrome-coherence.test.ts`,
`test/schema/registration-checks.test.ts`.

**G1.19 · Multi-scope commit path.** A scope's declared path still resolves to its captured node,
checked over all scopes _before_ any spine is copied, since a stale-but-in-range path would copy and
rebuild the wrong spine. Inline closure, watcher-netted. In `editor-actions/commit/structural-commit.ts`.

**G1.20 · Unshared-spine depth.** The chain the keystroke's in-place write copies is as deep as
the leaf path it was given; a short chain means the write would change a node it doesn't own, so it
writes nothing. Inline closure, watcher-netted. In `editor-actions/leaf-write.ts`.

**G1.21 · Column-scope alignment.** Each row scope in a column edit IS the corresponding child of
the owned table, so the id/ref sync lands on the rows the splice actually walked. Its tag is
`column-scope-alignment`. Inline closure, watcher-netted. In `editor-actions/table-context.ts`.

**G1.22 · Unshare path in range.** Every index on an unshare path addresses a live child; an
out-of-range index silently truncates the chain. Inline closure, watcher-netted. In
`tree-operations/unshare.ts :: ensureUnsharedPath`.

**G1.23 · No decoration sources mid-commit.** A decoration source running mid-commit would read a
half-written tree, so `notifyEdit` and `runAll` assert no commit is open, and a source handle's
`invalidate()` waits until the last one ends. The commit helper opens and closes the scope in
`invariants/commit-scope.ts`. Inline closure, watcher-netted. In
`decorations/decoration-state.svelte.ts`.

**G1.24 · Closure-block coherence.** A kind's required closure block (its written answer to every
cross-cutting editor system) agrees with the rest of its descriptor: a container can't claim
`roundTrip: inherit-default` (its `rebuildRaw` IS its round trip), a `not-mergeable` kind can't
claim `mergeBackspace: inherit-default`, a cell claiming focus-then-delete needs
`blockFocus: 'whole-block'`, and a `reservedChrome` declarer can't leave
`clipboard: inherit-default`. A declared `conformanceFixture` must parse to a tree containing its
kind; that rule runs in the unit sweep, since a `parse` import in the flush would close an import
cycle. Predicate `checkClosureCoherence` (`registry.ts`) · bootstrap (registration rules) plus the
unit sweep (fixture rule) · `closure-coherence.test.ts`, `closure-fixtures.test.ts`.

**G1.25 · Widget-pool pass bracket.** Inline widgets (the rendered stand-ins for inline constructs)
are recycled through a pool, one bracket per render pass: every `acquire` sits inside an open
`beginPass`/`sweep` bracket, `beginPass` never opens over an unswept pass, and `sweep` never closes
one that isn't open. Outside a bracket, byte-identical duplicate widgets can't be told apart.
Predicate `checkPoolBracket` (`inline-transitions.ts`) · run in `components/blocks/widget-portal.ts` ·
`inline-transitions.test.ts`, `test/blocks/widget-portal-bracket.test.ts`.

**G1.26 · Reveal transition legality.** A reveal draws an inline widget as its editable source, and
a close draws the widget again; what was typed in between was written as it landed. **No close
without a reveal**: `closeShownSource` runs only with a source shown, so a fire is a caller that
skipped its pre-guard. **No mutation with a reveal** (`command-during-reveal`): a block's command
dispatch never mutates while a reveal is open, so it acts on the rendered block; a fire is a command
entry path that skipped the close.
`startReveal` is also never re-entered inside the reveal's own microtask-long settle window, and the
source-length precondition holds at reveal entry. Legal bails (blur with no reveal, a blur during a
cross-block selection that keeps the source shown, entry while one is active) stay silent. Inline
closures in `components/blocks/text/widget-interaction.ts` (the close halves) and
`components/blocks/text/inline-commands.ts :: perform` (the mutation half), plus
`checkRevealSourceLength` (`inline-transitions.ts`) at `caret/reveal-source.ts` ·
`test/blocks/text/widget-reveal-transitions.test.ts`.

**G1.27 · Composition window.** `compositionend` lands only inside a composition the surface
opened, at its start or, when a range across blocks was live at the start, at its first composed
character. An unpaired end means `compositionend` was wired without `compositionstart`, and every
composed keystroke committed mid-IME. Predicate `checkCompositionEndPaired`
(`inline-transitions.ts`) · run in `components/blocks/editable/editable-surface.ts :: onCompositionEnd` ·
`inline-transitions.test.ts`, `test/blocks/editable/editable-surface-composition.test.ts`.

**G1.28 · Rendered text fidelity.** A code block's rendered fragment carries the block's bytes
exactly (`textContent === trimTrailingLineEnding(raw)`), because the body goes through
`template.innerHTML`, whose normalizations (a dropped U+0000, say) could eat a byte the block reads
back on the next keystroke. A painted editable-leaf source is held to the same equality, whatever
plugin painted it, since the fold commits `textContent` on blur. Predicate
`checkRenderedTextFidelity` (`render-fidelity.ts`) · run in
`components/blocks/code/code-renderer.ts :: renderCodeBlock` and
`components/blocks/editable/editable-leaf.ts :: paintSource` · `render-fidelity.test.ts`,
`test/blocks/editable-leaf-painted-fidelity.test.ts`.

**G1.29 · Selection endpoint coordinates.** An endpoint's offset means what its own block's
coordinate space says. On a table that's a cell index inside the grid, and the point says so with
`cellCoordinate: true` (every point on a table path, a rectangle's corners included); readers trust
the flag, so a bare offset there makes copy slice the table as text. A cell index on a block with no
cells fires too. Every other endpoint lands inside its block's raw, and in a kind with no character
positions (childless `blockFocus: 'whole-block'`) on one of its two ends. Clamp cell indices with
`src/lib/schema/block-kind-descriptor.ts :: clampCellIndex`; which blocks count cells is
`src/lib/schema/block-kind-descriptor.ts :: countsCells` (tables only for now; a plugin grid's
endpoints stay deep `[grid, row, col]` paths with character offsets). Predicate
`checkCrossBlockEndpointCoordinates` (`selection-endpoints.ts`) · run in
`selection/selection-state.svelte.ts :: enterCrossBlock` and `extendFocus`, the only two ways a pair
gets stored · `selection-endpoint-coordinates.test.ts`.

**G1.30 · Merge-role vocabulary.** Every registered kind declares a `mergeRole` from the known set;
an unknown role makes the merge dispatcher fall through silently on every gesture that reaches the
kind. Predicate `checkMergeRoleVocabulary` (`registry.ts`) · bootstrap · `category-fields.test.ts`.

**G1.31 · Inline-construct policy coherence.** The inline-construct policy table (one row per inline
kind: how it splits, unwraps, reveals) is coherent: a row names a kind the inline vocabulary holds
(a typo just keeps the absent-row defaults), the marker-rewriting behaviors (the `close-and-reopen`
split, the empty auto-unwrap) belong only to a revealable kind, no two mark rows claim one nesting
rank or one command, and a plugin row's mark may not claim a built-in command id (also refused
outright at `schema/inline-construct-policy.ts` registration). Checked at the editor-mount flush
only, since the policy's function hooks load with the component layer. Predicate
`checkInlineConstructPolicy` (`registry.ts`) · mount (`invariants/install.ts ::
runStartupInvariantChecks`) · `inline-construct-policy-coherence.test.ts`,
`test/schema/inline-construct-policy.test.ts`.

**G1.32 · Retired upward.** The rule was: a kind declaring `contentStartBackspace` also declares
`getContentRange`, since without the range its content starts at raw 0 and the demote never fires.
A registration now declares the two as one group, `contentStart: { range, backspace? }`, with the
range required, so the runtime guard and its test are deleted. Superseded by G3.10.

**G1.33 · The caret can land.** A block a caret is placed in, under an editable marker-hiding mode
(live, preview-inline), paints at least one position a caret can land on. A surface whose every byte
is a hidden marker run takes the next keystroke between `display:none` spans, on whichever side the
engine picks (a typed `#` once came back as `a#`). Built-ins hold by construction (chrome standing
over no content paints; `docs/design/live-mode.md` § 4.1), so this is for a plugin surface building
its own marker chrome. It fires from the editor root's `focusin`, once per focus arrival, so a caret
component a consumer owns inherits it; reading mode is out of scope. Predicate `checkLandableCaret`
(`landable-caret.ts`) · `components/editor-root/focus.ts` · `landable-caret.test.ts`,
`landable-caret-doors.test.ts`.

**G1.34 · Retired.** The rule was: the index a split's caret lands on is the one `splitNode`
returned, never a re-derived `blockIndex + 1`. The guard could never fire (it compared the split's
answer with itself). A split now builds its landing from `SplitResult.secondHalfIndex`, and G4.43
keeps every split call reading it.

**G1.35 · Single-node sink.** A sink (a slot that installs exactly one node) never installs bytes
that reparse to several. Every join (Backspace, Delete, the list-item merge) writes through
`joinIntoLeaf`, which refuses a join whose bytes read as two blocks: the gesture changes nothing and
the caret moves across the boundary instead. Arriving plural is legal; installing plural is the
fire. Predicate `checkSingleNodeSink` (`single-node-sink.ts`) · run in
`tree-operations/node-ops.ts :: mergedLeafFor` ·
`test/tree-operations/merge-multi-block-refusal.test.ts`.

**G1.36 · Structural-descriptor coherence.** A `StructuralChange` (the record a mutation publishes
so the id and ref arrays can follow a splice) fits the array it syncs (no negative slot count, no
window past the end), and every place the commit publishes ids leaves one id per child. `childSpans`
gets the same one-pair-per-child reading over the touched nodes, and every container below them that
keys children by id is checked at every depth. The record is checked where it's applied
(`applyStructuralChangeToIdsRefs`) and again where the commit publishes each scope's ids, since a
record can fit its own array while describing the wrong window. The e2e teardown
(`src/lib/e2e/container-parity.ts`) and the test bridge (`src/routes/test/editor/test-probes.ts`)
run the id check over the whole document. Predicates `checkStructuralDescriptor`,
`checkIdsChildrenLockstep`, `checkChildSpansLockstep` (`structural-descriptor.ts`),
`checkChildIdParity` (`child-id-parity.ts`) · run at
`tree-operations/structural-change.ts :: applyStructuralChangeToIdsRefs`, the commit primitive
(`editor-actions/commit/structural-commit.ts`), and `invariants/install.ts :: assertCommittedNodes` ·
`structural-descriptor.test.ts`, `test/schema/child-spans.test.ts`,
`test/selection/cross-block/cross-block-delete-seam-fold.test.ts`,
`test/invariants/child-id-parity.test.ts`.

**G1.37 · Retired upward.** The rule was: `contextDependentKind` (a kind with no opener of its
own, whose container writes its syntax) never sits beside an opener, since it suppresses the reparse
for a kind the parser can recognize. The two used to live in different registries; now the opener
is a field of the registration, so the pair is G3.10's `context-dependent-opener` row: a type error,
and a throw for a cast. Its bootstrap check and tests are deleted.

**G1.38 · Faithful container splices** (`child-spans-faithful`). After every one-region splice,
dev re-derives the whole container raw on a scratch node and, on any difference, refuses the splice
(the node takes the full rebuild instead) and names the kind. Code that moves bytes beside the
spliced child (a separator a settle retires, a borrowed wrap slot) retires the spans itself in
`schema/child-spans.ts`; this is the backstop under it, and the only guard that sees a stale
container raw between commits. Production pays nothing. Predicate
`schema/child-spans.ts :: spliceIsFaithful` (the one predicate outside `invariants/`) · the splice
path · `test/schema/child-spans.test.ts`, `test/schema/child-spans-settle.test.ts`,
`child-spans.property.test.ts`.

**G1.39 · One synthetic caret.** Beside a non-editable inline widget and at a gap between blocks
the browser draws no caret, so the editor draws one, and across the editor at most one shows. Held
by construction, twice over: the drawn caret is one element per editor, and each paint moves it into
the host it draws in, so a block that unmounts with it inside leaves nothing behind; and a paint reads
the widget edge a click meant only through the focused editable's own owner, which no unmounted
block's editable can be. (Releasing a torn-down owner's edge is tidying: nothing can read it.)
`caret/drawn-caret.svelte.ts` · G4.141's and G4.144's scans ·
`e2e/tests/blocks/image/caret-synthetic-indicator.spec.ts`.

**G1.40 · Built-in presentation facts** (`builtin-presentation-facts`). A plugin kind may leave
`pageRole` and `estimateHeight` out and take the defaults; a built-in must declare both, so nobody
gets the defaults without deciding to. Predicate `checkBuiltinPresentationFacts` (`registry.ts`) ·
bootstrap · `test/invariants/builtin-presentation-facts.test.ts`.

**G1.41 · The open last line** (`last-line-kept`). Only the document's last line may lack a line
ending, and a structural edit leaves it the way it found it: a file with no final break still has
none afterwards, unless its new last line is blank (dropping that break would drop the line). Which
child holds a block's last line is the kind's `lastLineChild` (read through
`schema/container-raw.ts :: childHoldingLastLine`; an answer past the children warns
`last-line-child-range`), and whether that line is blank is
`tree-operations/open-tail.ts :: holdsBlankLastLine`. The commit owns the rule in two steps,
`tree-operations/open-tail.ts :: endWindowLines` inside the commit's fix-up, before the separators, and
`tree-operations/open-tail.ts :: keepOpenTail` after the containers rebuild, and no edit writes the
tail by hand (G4.74). A move (`tree-operations/reorder.ts`) still calls `endWindowLines` itself,
since it checks its own joins before the commit's fix-up runs.

After every structural commit the check fails three shapes: an open file that gained a break on a
line with text, a closed file that lost its break, and a line with no ending right above the last
line at any depth (two lines that read as one on reload). Where a container's own bytes hold its
last line (a quote's closing `>`, a directive's closing `:::`), it reads the children above that
line through `schema/container-raw.ts :: lineChildren`. Predicate
`invariants/open-tail.ts :: checkLastLineKept` · both commit branches in
`editor-actions/commit/undo-controller.ts` · `test/invariants/last-line-kept.test.ts`,
`test/editor-actions/open-last-line.test.ts`, `open-last-line.property.test.ts`.

**G1.42 · A list item's checkbox and blocks say what its reload reads** (`task-marker-slot`). A
to-do's checkbox is metadata on the list item, but a write changes the block behind it, so the two
can drift. A list item's checkbox, and the kinds of its blocks, match what a reload of its bytes
gives: a heading behind a checkbox (`- [ ] # b` read by a plain parse) fails, and so does a plain
item whose text now opens with `[ ] `. An item holding no block is G1.44's. Writes into an item's
first slot go through `tree-operations/list/reconcile-task.ts :: writeKeepingTaskMarker` (G4.82), a
block replacing a to-do's text gives the box up only where the bare bullet still holds it
(`tree-operations/list/reconcile-task.ts :: landAtTaskStart`), and this check catches a route that
read its bytes with the wrong reader. Predicate `invariants/node-shape.ts :: checkTaskMarkerSlot` ·
the commit, over its touched nodes · `test/invariants/task-marker-slot.test.ts`.

**G1.43 · A landing is a value** (`landing-is-a-value`). A commit's `landing` says where the caret
goes and places nothing; the commit puts the caret down after its tick through the one caret landing
(`selection/caret-landing.ts`). A landing read that moved focus or the selection fails here.
Predicate `invariants/landing-value.ts :: checkLandingIsAValue` · run by
`editor-actions/commit/undo-controller.ts` · `test/invariants/landing-value.test.ts`.

**G1.44 · The document keeps a block** (`keeps-a-block`). A structural commit never leaves the
document with no children, nor a container it touched with none, unless the kind is a whole-block
one (a diagram holds no child on purpose; `schema/block-kind-descriptor.ts :: mustHoldChild`
decides). The commit gives an emptied document one empty paragraph itself
(`tree-operations/keep-one-block.ts :: keepOneBlock`), and an edit that empties a container removes
it, through `tree-operations/cleanup.ts :: cascadeCleanupEmptyAncestors` or
`editor-actions/nested/emptied-container.ts :: removeEmptiedContainer`. The check is for a new route
that skips both. Predicate `invariants/keeps-a-block.ts :: checkKeepsABlock` · both commit branches
in `editor-actions/commit/undo-controller.ts` · `test/invariants/keeps-a-block.test.ts`,
`test/editor-actions/document-keeps-a-block.test.ts`.

**G1.45 · A landing's focus scrolls nothing** (`landing-focus-scrolls-nothing`). The caret
landing's reveal is the one scroll a landing makes, through the scroll owner, so a focus call
without `preventScroll` that moved the scroll position fails here. Predicate
`invariants/landing-focus-scroll.ts :: checkLandingFocusScrollsNothing` · run by
`selection/caret-landing.ts` · `test/selection/caret-landing.test.ts`; G4.91 is the source half.

**G1.46 · A placed caret leaves no widget selected** (`placement-ends-widget`). Once a block's
`focus`, a range put down inside one block, or a restore has placed its caret or range, no inline
widget is still selected whole; one that is would look selected while the keys go to the caret.
`placeCaret`, `selectInBlock` and `applySelectionToDom` check it inside their batch. Predicate
`invariants/placement-ends-widget.ts :: checkPlacementEndsWidget` · run by
`selection/place-caret.ts` and `selection/native-bridge.ts` ·
`test/invariants/placement-ends-widget.test.ts`; G4.94 is the source half.

**G1.47 · A child measures into its own list** (`measures-in-own-list`). Each block list provides
one measure channel to its direct children, who register through
`windowing/use-measured-child.svelte.ts :: useMeasuredChild` with their own path. The channel
refuses a path that isn't one of its own children (a child that found a list further up, say a list
item calling the hook after it provided its own inner list, would land its height in a table that
doesn't index it). Predicate `invariants/measures-in-own-list.ts :: checkMeasuresInOwnList` · run by
`windowing/use-container-windowing.svelte.ts` ·
`test/windowing/measured-child-routes.svelte.test.ts`; G4.97 is the source half.

**G1.52 · The cached text is the document** (`current-source`). `getSource()` serializes once per
content version, and a `source` prop write is compared with that string, so a write that changed
bytes without bumping the version (G4.52 scans for those) leaves the editor reporting text it no
longer holds. The first reuse of a version's text re-serializes in dev and compares; it's skipped
while the perf instruments are armed; the `source` swap compare reads the cache unchecked, since an
echoing host reaches it on every keystroke. Predicate
`invariants/current-source.ts :: checkCurrentSource` · run by
`editor-actions/commit/current-source.ts :: createCurrentSource` ·
`test/editor-actions/commit/current-source.test.ts`.

**G1.53 · Retired.** The rule was: a write made for a document a `source` swap replaced is refused,
and a dev build says so (`stale-document-write`). The refusal stays, quietly, in every build, in
`editor-actions/commit/reading-write-gate.ts :: admitsWrite`: a late write after a swap (a paste
whose clipboard read finished late) is ordinary, not a bug.

**G1.54 · The tree's top-level array comes back untouched** (`top-level-untouched`). A commit with
the document among its scopes hands its mutation a plain copy of the top-level array and installs it
at publish. A mutation that writes the tree's own array instead has its splice thrown away, so the
commit fails here if that array was replaced or written (skipped while the perf instruments are
armed). Predicate `invariants/top-level-untouched.ts :: checkTopLevelUntouched` · run by
`editor-actions/commit/structural-commit.ts` · `test/invariants/top-level-untouched.test.ts`,
`test/perf/top-level-splice-writes.test.ts`.

**G1.55 · A written block reads back as itself** (`reads-back`). After a keystroke's rebuild and
after every commit, dev parses each top-level block the edit wrote in, on its own, and compares the
shape (kinds, child counts, metadata) with the tree's; a dropped leading space that re-nests a list
passes every byte check and fails this one, and so does a paragraph whose bytes reload as a
heading. A keystroke at the top level isn't checked, since its write already takes the kind a
reparse gives. It reads the bytes the way the editor opens a file
(`schema/opened-reading.ts :: readAsOpened`), so a bare `- ` reads back with the empty paragraph
you type into, and a container left with no bytes at all fails, since a reload wouldn't show it.
The edit names those blocks itself, so the check never searches the document. It skips a block over
16K characters and anything the perf instruments time. Predicate
`invariants/reads-back.ts :: checkReadsBack` · run by `editor-actions/leaf-write.ts` and
`editor-actions/commit/undo-controller.ts` · `test/invariants/reads-back.test.ts`.

**G1.58 · An indent key over a range keeps every word, in order** (`range-indent-keeps-text`). Tab,
Shift+Tab or a rebound indent key over a range moves list items, shifts code lines, or does what a
kind registered through `registerRangeIndent`, and nothing else. After each press dev compares the
leaf text of the spanned top-level blocks, in document order and whitespace aside, with what was
there before; a renumbered marker or an added tab passes, a lost or moved word fails. The reading is
`invariants/leaf-text.ts` :: `leafTexts`, shared with G1.61. Predicate
`invariants/range-indent-keeps-text.ts :: checkIndentKeepsText` · run by
`selection/cross-block/range-indent.ts` · `test/invariants/range-indent-keeps-text.test.ts`.

**G1.61 · A list move keeps the order** (`list-move-keeps-order`). Every nest, lift, unwrap and
merge that moves blocks between list levels (Tab, Shift+Tab, Backspace at a sublist's start or on a
first item, Enter in an empty item) keeps the list's leaf text in order, read as G1.58 reads it,
before and after. A merge's check reads only the two lines it joins, since a live-mode join can drop
markers. Predicate `invariants/list-move-keeps-order.ts :: checkListMoveKeepsOrder` · run by
`tree-operations/list/item-moves.ts`, `tree-operations/list/item-partition.ts` (G4.123) and
`tree-operations/list/unwrap-merge.ts` · `test/invariants/list-move-keeps-order.test.ts`, and
`test/blocks/list/indent-keeps-order.property.test.ts` over loose, ordered, quoted and side-by-side
lists.

**G1.71 · A command key over a range runs where it was claimed** (`command-key-landing`). Over a
range, a key is a command key when the keymap of the block the removal will leave the caret in binds
it (`selection/removal-landing.ts` :: `removalLanding` picks that block before anything moves).
After the removal the command must run in a block of the kind whose keymap claimed the key (kinds
only, since a join can move the caret's offset). Predicate
`invariants/command-key-landing.ts :: checkCommandLanding` · run by
`selection/cross-block/range-replace.ts` · `test/invariants/command-key-landing.test.ts`.

**G1.75 · The caret goes before an empty block's `<br>`** (`caret-before-break`). An empty
editable holds one `<br>`, and a caret after it looks the same as one before it, but in Chromium a
composition started after it is dropped after its first update (no `compositionend`), losing or
doubling the composed text. Every caret and range the editor writes passes
`caret/widget-offset.ts :: writeSelection`, which checks both endpoints in dev. Predicate
`invariants/caret-before-break.ts :: checkCaretBeforeBreak` ·
`test/invariants/caret-before-break.test.ts`; G4.36 keeps every native selection write in that file.

**G1.76 · The drawn caret agrees** (`drawn-caret-agrees`). At a `selectionchange` with no paint
pending, a caret still where the last paint drew it must still measure where the bar sits, within a
pixel. A fire means something changed the caret's line without writing the caret; call
`EditorServices.drawnCaret.request()` where that change is made. It doesn't run after a typed key, a
click or a press (each asks for a paint first), it can't see a caret range that was wrong to begin
with, and a reflow of the editable is left to its size observer. A bar at a code chip's stop draws
against the chip's box, not the caret's, so it's not checked. Predicate
`invariants/drawn-caret.ts :: checkDrawnCaretAgrees` · run in `caret/drawn-caret.svelte.ts` · every
e2e run through the invariant watcher, and `e2e/tests/caret/drawn-caret.spec.ts`.

**G1.77 · One caret showing** (`one-caret-showing`). After every paint, the `data-caret-drawn`
attribute (which hides the browser's caret) sits on exactly the editable the bar draws for, and on
none while the bar draws nothing, so the page never shows two carets or none. The one exception is
a press whose click will move the caret (beside a widget, inside a marker prefix), where the
attribute goes on before the click draws the bar, so the browser's caret doesn't paint the spot. An attribute, since Svelte rewrites an editable's whole
class list when its kind changes. Predicate
`invariants/drawn-caret.ts :: checkOneCaretShowing` · run after each paint in
`caret/drawn-caret.svelte.ts` · `e2e/tests/caret/drawn-caret.spec.ts` (`caretsShowing`, one caret in
every row).

**G1.87 · Nothing outlives the unmount.** Unmounting ends the document in place, so a write still in
flight (an `insertMarkdown` waiting on a tick, a paste waiting on its clipboard) is refused quietly
at the write gate, the way one for a document a swap replaced is; a write that names no document
counts as one for the document that just ended. The events go quiet at the same moment, and a caret
landing stops at its next await instead of reading the torn-down lists. Nothing is asserted, since a
host unmounting mid-write is ordinary. `editor-actions/commit/reading-write-gate.ts :: admitsWrite`,
`editor-actions/commit/document-stamp.ts :: end`, `block-lists/child-list.ts :: descendTo` ·
`editor-root/destroy-mid-write.test.ts`, `editor-actions/commit/document-stamp.test.ts`,
`block-lists/child-list.test.ts`, `selection/caret-landing.test.ts`.

**G1.90 · A foreign Svelte runtime is named.** A plugin component compiled against a second copy of
Svelte (a precompiled plugin on the prebuilt build, say) fails the moment the editor mounts it,
since its runtime has no component or effect in progress. Every route that mounts a plugin's
component (the block's error boundary, `plugin-view.ts :: mountPluginView`, the inline menu's row
boundary) asks `foreign-runtime.ts :: isForeignRuntimeError` and warns `foreign-runtime` in dev, and
the block's notice names the cause too; G4.178 holds new routes to it. The match reads the message
(`effect_orphan`, or the two crashes of a runtime that never mounted anything), so a plugin's own
`undefined.call` can match as well. `components/foreign-runtime.test.ts` loads its fixtures on a
second runtime through a module reset.

**G1.91 · A live removal keeps the marks it keeps.** A live-mode delete, cut or typed-over range
that cuts through a format run closes the run on the half before the cut and reopens it on the half
after, so every character it keeps shows in the marks it had. The join rewrite only writes a
reading that keeps them, checked against each side's own render. Where no spelling of the run can
close (a closer that would touch a run of its own character), it drops the run instead, and the text
stays with no marker on screen. `core/inline/live-edit/live-join.ts :: cleanLiveJoinSeam` ·
`test/invariants/live-seam.property.test.ts` and `test/simulation/live-gesture-fuzz.property.test.ts`
(each kept character's marks, read by `test/harness/live-oracles.ts :: markedChars`, with the drop
fallback held to a small share), `test/core/inline/live-join.test.ts`.

**G1.94 · One editor per target.** A wrapper that skips `destroy` on unmount stacks a second editor
in the same element, and React's StrictMode (which mounts every component twice in dev) shows it at
once. `createEditor` remembers which targets hold an editor it hasn't destroyed and warns
`target-occupied` in dev on a second mount there. `editor-root/create-editor.test.ts`.

**G1.96 · One lifecycle for every plugin view.** An inline widget, a decoration's widget or badge,
and an inline menu row are each a `PluginView`, mounted through `plugin-view.ts :: mountPluginView`
into an element the editor made. A view mounts once, takes new props through `update` (a widget
typing moved, a decoration in the same place, a row turning active), and is destroyed once. A throw
at any of the three is reported once, the view is never called again, and the slot draws its
fallback. A pooled widget or a badge mounts no new view while it stays put, and a pooled widget
whose source is shown stays alive undrawn, so it comes back as the same view when the source closes
unedited; a decoration widget is drawn afresh with its block, so a throwing one reports once per
rebuild.
`plugins/view/lifecycle.test.ts` (a DOM view and a Svelte one) and `plugins/view/failure.test.ts`
run every slot; G4.186 holds new routes to the wrapper.

**G1.97 · Vue hands over the real object.** A value a Vue app keeps in `ref` or `reactive` reaches
a component as a Vue proxy. The editor keeps a plugin by identity, so a proxied plugin and the
imported one would count as two plugins of one name. The Vue wrapper passes every option through
`toRaw` in its one options builder, and each `plugins` entry and the plugin inside it too, since a
plain list built from reactive state still holds proxies. The adapter suite's `vue.spec.ts` mounts
editors sharing a plugin, three of them taking it out of reactive state in those shapes, and fails
on the `plugin-install` warning a proxy would raise.

**G1.99 · The host colors resolve.** Inside the editor a host color read carries no fallback (G4.189),
because `editor.css` resolves each one to the page's value or the palette `editor-theme.css`
declares. An app that forgets the theme stylesheet on a page declaring no colors gets menus and a
find bar painted with none. Once an editor mounts with its own stylesheet applied (the `editor.css`
reset makes its root border-box), it checks that `--md-color-bg` resolves on the root, and warns
`invariant:host-colors-resolve` naming the import when it doesn't. A DOM with no stylesheet (the
unit suites) is skipped. `invariants/theme-stylesheet.ts`; `e2e/tests/theme-stylesheet.spec.ts`.

**G1.104 · Registered from a setup.** A register or declare call outside any plugin's setup, and
outside the editor's own bootstraps (`registerAsCore`), throws in a dev build, naming
`definePlugin` and, for a test on another runner, `configureEditorEnv({ isTest: true })`. A test
run is exempt and production isn't checked. The check sits in the store every registry is built on
(`schema/plugin-registry.ts`), behind `schema/plugin-install.ts :: rejectRegistrationOutsideSetup`.
No key is exempt, a built-in's included, so the editor's own load-time registrations run under
`registerAsCore` too, and only those replace a duplicate on a dev server. `test/schema/register-in-setup.test.ts` pins the throw, the test switch
and the replacement rule, and re-evaluates a plugin module to show the first registration wins;
`test/schema/dev-server-load.test.ts` loads every entry and installs every bundled plugin under a
dev server's flags.

**G1.106 · A kept table edge loses whole rows.** A selection that starts or ends inside a table
and runs past it deletes whole rows of that table, never part of one. `coverRange` in
`selection/range-coverage.ts` snaps both ends to a row's edge first. If a run that splits a row
still shows up (only an end that skipped the snap could hand one over), `rangeCoverage` warns
`invariant:kept-table-edge`. `test/selection/range-coverage.test.ts`.

**G1.110 · A leaf takes no metadata write.** A leaf's metadata is whatever its opener reads out of
its bytes (a heading's level, a code block's language), so a metadata write that leaves the bytes
alone is gone on the next reload. `editor-actions/block-edit-core.ts :: updateBlockMetadata`
refuses any kind that isn't a container before it writes: no bytes, no undo entry, no edit event.
A dev build warns `invariant:metadata-without-rebuild` naming the kind, and every build reports an
`error` event (`origin: 'commit'`) whose message points at `replaceRaw`, the bytes write a leaf's
command uses instead. `test/editor-actions/update-block-metadata.test.ts`.

**G1.112 · One fix-up per list.** A commit runs its fix-up (`tree-operations/settle.ts ::
settleEdit`) once over each list it wrote, so a mutation inside it writes content with
`writeNodeContent` and reports the write through its scope's `describeEdit`, leaving the fix-up to
the commit. A mutation that fixes up a list itself with `updateNodeContent` and then reports a
change there gets the fix-up twice, and a dev build warns `invariant:settle-once` (the record lives
in `invariants/settle-once.ts`; production never touches it). The check sees only that write: the
two edits that still call a separator helper by hand (codebase-map § Blank lines and separators) fix
up their list a second time, unseen. The format toggle over several blocks still fixes up its own
writes, at any depth and before its own chain rebuilds, so its commit says `fixesUpOwnWrites` and
the check skips it (G4.208 pins that list). `test/invariants/settle-once.test.ts`, and
`test/perf/settle-passes.test.ts` counts the passes each gesture runs.

**G1.113 · The marker is the item's bytes.** A list item draws its marker in a cell of its own,
built from its metadata, and source mode shows that cell as the item's first bytes. So the text it
draws has to be what the item's raw opens with, past the up to three spaces of indent. A rewrite
that moves the metadata without the bytes would show a marker the file doesn't hold. The item
checks it each time it builds the cell (`invariants/item-marker-bytes.ts`), and a dev build warns
`invariant:item-marker-bytes`. `test/invariants/item-marker-bytes.test.ts` runs the check over
generated documents too.

**G1.115 · A caret inside a source-showing widget stays put** (`widget-caret-landing`). An edit or
an arrival that puts the caret strictly inside a widget whose kind sets `revealSource` (a `#` typed
in front of `few` closes a tag around it) opens that widget's source with the caret at its byte.
The offset walk can't put a caret inside a widget it can't enter, so without the reveal the caret
would land past it and the next key would type after the tag. Both prose blocks put every such
caret down through `widget-interaction.ts :: restoreCaret`: the restore after an edit, an arrival
through `parkCaret` (a Backspace that joins `tag #` to `few`), and a restored selection (undo,
redo, `setSelection`), which the caret landing hands to the block or the table cell through
`selection/restored-caret.ts`. The caret a rebuild carries isn't one of them: it predates the edit
that caused the rebuild, so it goes back where it was and opens nothing. After a caret it didn't
reveal for, the check reads the caret back, and a caret that moved off its byte must sit at a widget with no source to
show (an emoji, an image), whose caret goes to the far edge. Predicate
`invariants/widget-caret-landing.ts :: checkWidgetCaretLanding` ·
`test/invariants/widget-caret-landing.test.ts`; G4.211 holds the e2e rows to every kind.

**G1.117 · A CRLF pair stays whole** (`line-ending-pairs`). WebKit and Firefox stop a caret between
a line's `\r` and its `\n`, and delete one of the two on its own. The DOM-to-raw read rounds a
position inside a pair to before it (`caret/widget-offset.ts :: domTextOffsetAtNode`), and the
input read-back edits the pair as one character
(`core/line-ending-pairs.ts :: keepLineEndingPairs`). A Backspace from inside a pair reads back as
the same bytes as a Delete before it, so the surface's keydown moves that caret before the pair
first (`caret/widget-offset.ts :: leaveLineEndingPair`). The check backs all three up, and catches any
other write too (a tree op, a plugin's rule): it compares the line-ending counts before and after
each commit and each keystroke written in place, and warns when a pair went missing while a lone
`\r` or `\n` turned up. Leaving the `\r` out of the DOM would make a split impossible to write, but
every read-back and offset walk counts on the DOM's text being the block's bytes, so this stays a
check. Predicate
`invariants/line-ending-pairs.ts :: checkLineEndingPairsKept` ·
`test/invariants/line-ending-pairs.test.ts`.

**G1.118 · A list's marker counts match its items** (`list-marker-widths`). The list node keeps how
many items open with a marker of each width, for the marker column (G4.215), and the parse and
the list's rebuild are the only writers. At the same moments as G1.55 and under its size limit,
dev recounts every list in the blocks the edit wrote and fails one whose counts are absent or
differ, which a route that changes items without rebuilding the list would leave. A commit that
fails puts the counts back with the bytes it saved (`test/editor-actions/commit/commit-rollback-bytes.test.ts`).
Predicate `invariants/list-marker-widths.ts :: checkListMarkerWidths` ·
`test/invariants/list-marker-widths.test.ts`.

**G1.119 · No caret inside a CRLF pair** (`caret-in-line-ending-pair`). A caret the editor writes
between `\r` and `\n` would edit inside the pair in WebKit and Firefox, so every selection write
checks both endpoints. Arrows cross a pair in one press (`selection/shared-keydown.ts`), and a
Shift+Arrow keeps an anchor the browser parked inside one before it
(`caret/widget-offset.ts :: extendSelectionToRaw`). Predicate
`invariants/line-ending-pairs.ts :: checkCaretOutsideLineEndingPair` · `test/invariants/line-ending-pairs.test.ts`.
