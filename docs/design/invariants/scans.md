# Group 4: source scans

The words this catalog leans on, and what the enforcement levels mean, are in [the index](../invariants.md).

These are tests that read the source text itself. They catch what a type can't express and a runtime
check can't see: a pattern anywhere in the tree, or a published table drifting from the code that
backs it.

Scans over the library live in `test/invariants/lint/` and ride `npm run test:editor:invariants`.
Scans over the e2e tree live in `e2e/lint/` (G4.17, G4.22, G4.23, G4.49, G4.133, G4.211,
G4.212) and **don't** ride that script; run them with `npx vitest run src/lib/e2e/lint/` (same in
bash and PowerShell), and `npm test` runs both.

This is the catalogued set, not the whole of `test/invariants/lint/`: a scan holding one module's
local rule gets a file without a G-number, so read the directory too before assuming a rule is
unguarded.

| ID     | What stays true                                                                              | Codes   |
| ------ | -------------------------------------------------------------------------------------------- | ------- |
| G4.1   | `createBlockListState` takes getters, never values                                           | L       |
| G4.2   | The render path computes inline content, never reads the cache                               | L       |
| G4.3   | Every container passes the conformance kit, and its declarations resolve                     | harness |
| G4.4   | No timing hacks for sequencing                                                               | L       |
| G4.5   | No synthetic `KeyboardEvent` in editor runtime source                                        | L       |
| G4.6   | Editor CSS and tokens live where the ownership rules say                                     | L       |
| G4.7   | A render memo keys on every input its built DOM embeds                                       | D·N     |
| G4.8   | Every documented chord resolves in the surface that dispatches it                            | L       |
| G4.9   | Every published theme token is declared, with light and dark values                          | L       |
| G4.10  | Every bundled plugin directory is exported, and the pack carries it                          | L       |
| G4.11  | Exactly the allowed paste routes apply paste transforms                                      | L       |
| G4.12  | Caret-edge destructive keys route through the one edge-policy dispatch                       | L       |
| G4.13  | No view-stripping cast outside `tree-operations/` and the undo controller                    | T·L     |
| G4.14  | Every component prop reading the CST is typed as a readonly view                             | L       |
| G4.15  | Coordinate brands are created only at their home modules                                     | L       |
| G4.16  | Bundled plugins import only the public authoring barrels                                     | L       |
| G4.17  | No spec is collected by two Playwright projects                                              | L       |
| G4.18  | The scan switch matches the trigger table; prefix handlers run from one site                 | L       |
| G4.19  | _Retired upward_: reading mode is refused at the commit, not per dispatch site               | L       |
| G4.20  | A new line takes the document's ending; per-line work reads no `\r`                          | L·N     |
| G4.21  | Image bytes are written only through the one image byte module                               | L       |
| G4.22  | An e2e wait predicate must describe the post-operation shape                                 | L       |
| G4.23  | Every e2e spec pairs with a requirement file, and vice versa                                 | L       |
| G4.24  | A block's write rule runs in the content write, which maps the caret                         | T       |
| G4.25  | No `import.meta` env read anywhere under `src/lib`                                           | L       |
| G4.26  | Comment budget: two lines a block, five a header, no house words                             | L       |
| G4.27  | Every `parse` call outside the parser declares its scope                                     | L       |
| G4.28  | A leaf raw write outside the content write names the kind's rule                             | L       |
| G4.29  | Every file claiming a hardcoded chord is manifested with its chords and keys                 | L       |
| G4.30  | Hidden-marker classification has one rule, applied in both spaces                            | L       |
| G4.31  | _Retired upward_: pending marks are a record only the block's write spends                   | T       |
| G4.32  | Every non-render inline read goes through `resolvedInlineContent`                            | L       |
| G4.33  | Live-mode byte candidates verify against what actually paints                                | L       |
| G4.34  | Link bytes are written only through the one link byte module                                 | L       |
| G4.35  | A construct stamps its markers exactly when its policy row says revealable                   | L       |
| G4.36  | The native selection is written only by the editor's caret writer in `widget-offset.ts`      | L       |
| G4.37  | Every surface rendering into a caret-walk container stamps content-empty                     | L       |
| G4.38  | Every editable surface publishes each of `EDITABLE_SURFACE_MEMBERS`                          | L       |
| G4.39  | Every text-surface component publishes `runCommand`                                          | L       |
| G4.40  | The three rewrite-claim lists are one set                                                    | N       |
| G4.41  | No test file mocks `dev-warn` or spies `console.warn`                                        | L       |
| G4.42  | No module writes a sibling's `leadingTrivia` by hand                                         | L       |
| G4.43  | Every `splitNode` call reads the index the split returned                                    | L       |
| G4.44  | Every prose surface resolves native ranged edits through the one resolver                    | L       |
| G4.45  | Every bare tree-op caller is declared with the commit that settles its writes                | L       |
| G4.46  | Every ancestry-rebuild caller states its fold-sink stance                                    | L       |
| G4.47  | Every contenteditable read routes through the host-aware predicate                           | L       |
| G4.48  | Wall-clock budgets outside the perf projects use the growth harness                          | L       |
| G4.49  | E2E composition rides the shared IME driver                                                  | L       |
| G4.50  | Every block command id is classified for cross-block ranges                                  | L       |
| G4.51  | A typing-checkpoint push always arms the pause window                                        | L       |
| G4.52  | The content version is announced at every place that writes document bytes                   | L       |
| G4.53  | The descriptor type and the published field table are one set                                | L       |
| G4.54  | A published entry barrel is never imported by its own import closure                         | L       |
| G4.55  | Docs name the package `@voithos-labs/aragonite`, never bare `aragonite`                      | L       |
| G4.56  | Inline-tree and rendered-DOM walks are iterative, never recursive                            | L       |
| G4.57  | The source-scan lexer agrees with TypeScript's                                               | L       |
| G4.58  | One commit-message rule, enforced at the hook and in CI                                      | L       |
| G4.59  | The VR tag catalog and the tags cited in source are one set                                  | L       |
| G4.60  | Every spread into a call's argument list declares what bounds its count                      | L       |
| G4.61  | The commit scope is set in production, not behind a build flag                               | L       |
| G4.62  | Code, grey, marker and faded-block text clear AA on the backgrounds under it                 | L       |
| G4.63  | The bundled plugins' own suites import only the published entry points                       | L       |
| G4.64  | The tree-ops layers import only downward                                                     | L       |
| G4.65  | Every prose surface hands typed delimiters to the one auto-pair arm                          | L       |
| G4.66  | A relative scroll is written through `scrollBy`, never read-plus-delta                       | L       |
| G4.67  | Every editor menu counts itself on `menuChange` and hands the registry its close             | T·L     |
| G4.68  | Every plugin registry read outside its module passes the editor's grammar                    | L       |
| G4.69  | Only entry points, kits and editor-free code read with the default grammar                   | L       |
| G4.70  | A decoration can't set a data attribute the editor uses on a block's own element             | L       |
| G4.71  | An emptiness test on text reads GFM's blank, not `String.trim()`                             | L       |
| G4.72  | The Markdown grammar reads GFM's whitespace, not JS `\s` or `trim()`                         | L       |
| G4.73  | A component built on the editable leaf exports `blockApi` and no block method of its own     | L       |
| G4.74  | Only the commit's open-tail steps write the document's last line ending                      | L       |
| G4.75  | A leaf's new text goes through one commit or one in-place write, at every depth              | L       |
| G4.76  | Every join into a leaf, and every other text built from two sources, is declared             | L       |
| G4.77  | Only three routes register on behalf of no plugin                                            | L       |
| G4.78  | The editor's built-in bootstraps run only through `registerEditorBuiltIns`                   | L       |
| G4.79  | Whether a kind is a grid is asked through `isGridKind`, nowhere else                         | L       |
| G4.80  | In `selection/`, only the range coverage and the caret walks ask if a container is closed    | L       |
| G4.81  | The cross-block table row snap runs in the range coverage and the stored pair only           | L       |
| G4.82  | The task-marker rule runs in one wrapper, and its callers are declared                       | L       |
| G4.83  | Every plain read of bytes into blocks outside the parser and test kits names its kind        | L       |
| G4.84  | Where a leaf's bytes are stored is made in one place, from the tree                          | L       |
| G4.85  | A live rewrite that removes bytes reads its candidate where it will be stored                | L       |
| G4.86  | A list item's marker is read only where the list is built, drawn or dumped                   | L       |
| G4.87  | Only the scroll owner writes the editor's scroll position                                    | L       |
| G4.89  | One in-leaf range replace, and a short list of places that snap an offset                    | L       |
| G4.90  | A paste inside one block cuts its selection through the range replace, with its text         | L       |
| G4.91  | A focus call that may scroll the editor says why                                             | L       |
| G4.93  | A measure round keeps only the block `heldBlock` picks, level by level                       | L       |
| G4.94  | A gap caret or a widget is selected only in `place-caret.ts`, and held in one store          | L       |
| G4.95  | What a range covers is decided in the range coverage only                                    | L       |
| G4.96  | A commit rebuilds each container once, and a mutation leaves that rebuild to it              | L       |
| G4.97  | A child's height reaches its list's table only through `useMeasuredChild`                    | L       |
| G4.98  | Only layout state drops the measured heights or moves the width version                      | L       |
| G4.99  | A windowed list's box is never shorter than its table while blocks mount                     | L       |
| G4.100 | A block's own trailing line ending is added by the surface write and a few listed routes     | L       |
| G4.101 | Only the surface write names a typed kind change or completes a typed line                   | L       |
| G4.106 | _Retired upward_: every test page load is a fresh document, and a load that isn't throws     | A       |
| G4.107 | Only a write emits `edit`, and only the in-place keystroke write declares `input`            | L       |
| G4.108 | Only the range replace removes a range; only it and the range indent open its undo step      | L       |
| G4.109 | A container built around another's children starts from that container's bytes               | L       |
| G4.111 | A block's editable element writes its own text only through the surface write                | L       |
| G4.112 | An indent key over a range reaches list items through one route, never removing the range    | L       |
| G4.113 | _Retired_: the `$$` shape is G4.131's `$$` row                                               | L       |
| G4.114 | How a block paints under a range is decided in the selection model only                      | L       |
| G4.115 | A clipboard payload is written only by a copy                                                | L       |
| G4.116 | The pending break answers a text block's key before the shared keymap                        | L       |
| G4.122 | Import edges between `src/lib`'s top-level directories match their baseline both ways        | L       |
| G4.123 | A dissolving list item's children are split only inside the list order check                 | L       |
| G4.125 | A component asks which inlines are widgets only in `widget-adjacency.ts`                     | L       |
| G4.126 | The dev server bundles every package the app imports before a page asks for it               | L       |
| G4.127 | Every branch on whether a DOM exists says what runs without one                              | L       |
| G4.128 | Every registered block kind shows the empty-block hint, or says why it's never asked         | harness |
| G4.130 | A code block edit over a range takes its span from `editSpan` only                           | L       |
| G4.131 | A block syntax's bytes are read and written in its own module only                           | L       |
| G4.133 | An e2e spec switches the presentation mode only through a helper that waits for it           | L       |
| G4.141 | Only the drawn caret writes its element and the mark hiding the browser's caret              | L       |
| G4.142 | `caret-color` is declared only for the known surfaces                                        | L       |
| G4.143 | Every caret write asks the drawn caret to repaint, and its frame paint only paints           | T·L     |
| G4.144 | The old widget and gap caret painters and the edge ring stay gone                            | L       |
| G4.145 | A click decides whether it follows a link or widget through the shared rule only             | L       |
| G4.146 | A release tells a click from a drag only through the editor's press tracker                  | L       |
| G4.147 | Every change to the caret memory repaints the drawn caret, and a no-op asks nothing          | harness |
| G4.148 | The caret's look adds no inline-tree walk, parse or paint to a key outside brackets          | harness |
| G4.149 | A preview of the next insertion runs a write's own spend, and changes no record              | harness |
| G4.150 | One placer for a hidden edge: no other file reads the caret's side or how it arrived         | L       |
| G4.151 | One click-side check, called from the click entry both prose blocks share                    | L       |
| G4.152 | Every rendered link has an Edit link target, and only the root click follows one             | T·L     |
| G4.155 | Every composing-flag holder asks both composition questions: a drop, and an opening          | L       |
| G4.157 | Every block kind a bundled plugin installs has an insert entry, or says why it has none      | harness |
| G4.159 | An emptied quote, list item or bundled strip container keeps bytes that reload as it         | harness |
| G4.163 | A mark's own handlers are called only by the hover lifecycle, activation and the click       | L       |
| G4.165 | A write that moves text without resizing its block reports it, so its overlays measure       | L       |
| G4.166 | Every length the drawn caret's rules set is rounded to whole device pixels                   | L       |
| G4.170 | Only the parser and the table rebuild write a row's header flag                              | L       |
| G4.174 | Every published entry point has a source build and a prebuilt one                            | L       |
| G4.175 | Every library component compiles in runes mode                                               | L       |
| G4.178 | Every route that mounts a plugin view falls back and reports when it throws                  | L       |
| G4.180 | Every top-right hover control on a block moves below the open find bar                       | L       |
| G4.181 | Every wrapper package carries the core's version and peers the core at exactly that          | L       |
| G4.183 | An app that doesn't compile Svelte installs no Svelte                                        | harness |
| G4.184 | The editor's own reset sets everything the demo app's global reset does                      | L       |
| G4.185 | Only the `/svelte` entry's published types reach a `svelte` import; none reach a stylesheet  | harness |
| G4.186 | A plugin's widget, decoration or row view is drawn only through `mountPluginView`            | L       |
| G4.187 | Every framework app under `examples/` runs in the adapter suite                              | L       |
| G4.188 | Every wrapper entry imports in Node with no DOM, as a server render does                     | harness |
| G4.189 | A host color read inside the editor carries no fallback, and the root reads the resolved one | L       |
| G4.194 | A block reaches the clipboard steps and its inline paste only through its editable surface   | L       |
| G4.195 | A paragraph's or a table cell's command takes its own undo step in one place                 | L       |
| G4.197 | A parse finds every built-in kind whichever module a host imports first                      | harness |
| G4.200 | Whether a block hides markers at the caret, with the screen it reads, is asked in one place  | L       |
| G4.201 | One painter puts the selection tint on an inline widget                                      | L       |
| G4.207 | Shipped CSS keeps `color-mix` and container queries behind `@supports`                       | L       |
| G4.208 | The fix-up after an edit is run by the commit or by the one write no commit follows          | L       |
| G4.209 | A list item draws its marker in its own cell, never through a child's prefix                 | L       |
| G4.211 | Every widget kind that shows its source has a row in the typed-opener e2e spec               | L       |
| G4.212 | E2E clipboard access and pastes ride the shared clipboard helper                             | L       |
| G4.214 | A caret's box is measured in one place, `caretRectAt`                                        | L       |
| G4.215 | A list's marker column reads no item of its own at load or on a key                          | harness |

### The entries

**G4.1 · Getter-fed block-list state.** No by-value `createBlockListState`: it takes getters only.
`lint/call-site-rules.test.ts`.

**G4.2 · Render path skips the inline cache.** The render path computes inline content via
`computeInlineContent`, never the caching `getInlineContent` accessor. Perf hygiene, since the cache
is a non-reactive WeakMap. Held by G4.32's row in `lint/file-rules.test.ts`, which bans the raw
accessor everywhere but its own module.

**G4.3 · Container conformance kit.** The kit plus declaration sanity: `unwrapRole` strategies
resolve, `containerPaste` has the right shape, `rebuildRaw` runs. Built-ins are swept
registry-derived; a plugin container opts in with its own profile through `runContainerConformance`
(`@voithos-labs/aragonite/testing`). Kit: `src/lib/testing/container-conformance.ts` · tests
`container-conformance.test.ts` (built-ins), `test/plugins/container-conformance.test.ts` (plugin
containers).

**G4.4 · No timing hacks.** No timing primitive is used for sequencing (`await tick()` is the one).
The allowlist in `lint/file-rules.test.ts` is short and closed, each entry with its reason: the rAF
throttles in `selection/autoscroll.ts` and `selection/pointer-session.ts`, the rAF placement in
`components/drag-handle.ts`, the rAF start of a size watch in `windowing/observe-resize.ts`, the drawn caret's frame paint in
`caret/drawn-caret.svelte.ts` (read-only, G4.143), the wall-clock undo debounce in
`editor-actions/commit/text-batch.ts` and the occurrence plugin's typing pause in
`plugins/highlight-occurrences/highlight-occurrences-plugin.ts`, and the scan deadline in
`search/regex-executor.ts`. The unit suites follow the same rule (a row of
`lint/suite-file-rules.test.ts`): a test waits with `src/lib/test/harness/settle.ts :: settleEditor`,
fake timers or `vi.waitFor`, never by flushing a macrotask.

**G4.5 · No synthetic keyboard events.** No synthetic `KeyboardEvent` in editor runtime source.
`lint/file-rules.test.ts`.

**G4.6 · CSS ownership.** `app.css` holds no editor rules or tokens; every editor-owned token read
is declared in `editor-theme.css`, except the resolved host colors (`--md-color-*`,
`--md-page-text`), which only `editor.css` declares, and the lengths `editor.css` registers with
`@property` (the list marker's column), which carry their own initial value; every radius read
carries a fallback; and host-chrome defaults sit behind the opt-in theme class alone (G4.6d), with
`editor.css` declaring a host color only where the root's children re-expose the resolved one. The bundled and reference
plugins follow the same rule and may also read tokens they declare. `lint/css-ownership.test.ts`
(editor), `lint/plugin-css-ownership.test.ts` (plugins).

**G4.7 · Render-memo completeness.** A block's render memo key includes every input its built DOM
embeds; no live value (tree path, index, load policy, checkbox state) is baked into the DOM unless
the key carries it. Resolve it live at event time, or key on it. A prose block's `renderKey` is
`ambientPrefixText` + `raw` + the link-reference-definition signature epoch + the image-load
policy, and the inline DOM depends on nothing else (the image widget once baked its block's path in,
and a shifted block selected a stale node). G4.2 is the one automated proxy; the rest is documented
(`D`) with regression tests (`N`): `src/lib/e2e/tests/blocks/image/widget-path-restability.spec.ts`,
`test/blocks/text/render-image-policy.test.ts`, `test/blocks/list/task-checkbox.test.ts`.

**G4.8 · Documented-chord dispatch.** Every chord the consumer guide's keyboard table lists resolves
in the surface that dispatches it (the keymap registry, the search components, or the clipboard
paths). The reverse sweep covers what this repo ships (built-in and bundled keymaps, the global
keymap, bundled global chords, the hardcoded-chord files) and keys each claim by chord and owner, so
`Mod+Enter` on a task item and in a table cell each need a row or a recorded reason; a stale
exemption fails. `lint/consumer-guide-chords.test.ts`.

**G4.9 · Theme-token manifest.** Every token the consumer and plugin guides publish is declared in
`editor-theme.css`, and a themed token carries both a light and a dark value.
`lint/theme-token-manifest.test.ts`.

**G4.10 · Plugin package and pack parity.** Every `src/lib/plugins/<name>` directory is exported as
`./plugins/<name>`, and verify-pack derives its required files from that (`scripts/pack-manifest.mjs`);
a plugin module with a top-level CSS import is declared in `sideEffects`. The `/renderer` subpaths
are extra. `lint/plugin-pack-parity.test.ts`.

**G4.11 · Paste-transform site parity.** Exactly the allowed clipboard-to-parse routes call
`applyPasteTransforms`, since a new route without it drops plugin transforms. A route that never
names the symbol is caught too: every clipboard or drop read must reach an allowed route.
`lint/manifest-rules.test.ts`.

**G4.12 · Caret-edge destructive keys.** Every plain Backspace or Delete intercepted at a caret edge
in a prose block routes through the one edge-policy dispatch, which resolves what sits at the edge
against declarative policies and commits through `surface-write.ts :: writeText` or
`updateBlockContent`. The only other interceptors are the selected-widget second-press delete and
the pending break's Backspace (`pending-break-keys.ts`). `lint/manifest-rules.test.ts`.

**G4.13 · The view-to-mutable boundary.** No `as CstNode` or `as Document` view-stripping cast
outside `tree-operations/` and the undo controller. Readers hold bytes-readonly views
(`core/node-views.ts`) and get a mutable node only by copying its path or through a commit scope's
owned view. `lint/file-rules.test.ts`; type pins in `test/core/node-views.test.ts`.

**G4.14 · Readonly-view prop parity.** Every `.svelte` component prop reading the CST is typed
`NodeView` or `DocumentView`; registration erases prop types, so a `node: CstNode` would compile.
Only `Editor.svelte` holds a mutable `Document`. `lint/file-rules.test.ts`.

**G4.15 · Coordinate-brand creation.** `as <Brand>` casts and the `as*` boundary constructors appear
only in `caret/coordinate-spaces.ts` and the allowlisted public-entry files; everything else gets a
brand through those or a named conversion. G3.7's runtime-source complement.
`lint/file-rules.test.ts`.

**G4.16 · Bundled-plugin import boundary.** Every file under `src/lib/plugins/**` imports only the
public authoring barrels (`#lib/plugin.js` and `#lib/svelte.js`), its own plugin directory, `svelte`,
or, for a `renderer.ts`, its one declared rendering engine, which proves the barrels are complete.
Every import-boundary scan (this one, G4.63, G4.64, G4.122) reads specifiers through
`src/lib/test/invariants/lint/scan-source.ts :: importSpecifiers`, so an import quoted in a string
or comment is no edge. `lint/plugin-import-boundary.test.ts`.

**G4.17 · One Playwright project per spec.** No spec file is collected by two Playwright projects
(the WebKit lane doesn't count). The scan reads what `playwright test --list` reports, so the glob
depth rules are Playwright's own; a spec no project collects is G4.23's.
`e2e/lint/project-partition.test.ts`.

**G4.18 · Inline-trigger parity.** The characters the inline scanner handles itself live in one
table, `core/inline/scan/triggers.ts :: BUILTIN_TRIGGERS`: a handler per row, plus when the fast bail
(the check that lets plain prose skip the scan loop) looks for it (always, only while a plugin
handler is registered on it, or never). A new built-in trigger is one row there plus one case in the
scan loop's `switch` (kept a switch because a table lookup measured slower).
`test/core/inline/scan/builtin-trigger-dispatch.test.ts` checks every ASCII character and table key
runs exactly its row's handler, and `lint/inline-prefix-consultation.test.ts` keeps the plugin
prefix-handler check before the switch at one site.

**G4.19 · Retired upward.** The rule was: every command dispatch site checks reading mode. Every
byte writer now asks `editor-actions/commit/reading-write-gate.ts` itself, so a site that forgets
can't write, and G4.52 holds each writer to asking.

**G4.20 · One document line ending.** Every new line the editor writes takes the document's line
ending, its first line break (`src/lib/core/lines.ts` :: `documentLineEnding`), and per-line work
reads each line without its ending (`src/lib/core/lines.ts` :: `displayLines`).
`trailingLineEnding(raw, fallback)` takes the fallback as a required argument: pass the document's
ending where a document is in reach (a commit's scope, a paste's context, or `ctx.lineEnding` in a
write rule or context action), else the block's own first break, and LF for a block with no line
break at all. A write to a block's own text keeps the ending it has (G4.100). The scan fails a
`split('\n')` over a block's bytes outside `core/lines.ts` and three allowlisted readers, an
`updateBlockContent` argument ending in a newline literal, and an unallowlisted `raw` write creating
one. `lint/trailing-line-ending-parity.test.ts`; `crlf-edit-mirror.test.ts` and
`crlf-typed-break-mirror.test.ts` run each gesture on LF and CRLF twins and require mirrored
results.

**G4.21 · Image byte-write module.** The GFM image serializer is named in code only inside the
image byte module, and only the documented write paths name `buildImageEditBytes` (the popover takes
the answer as a prop and names neither), so no route re-emits GFM over an image an inline plugin
kind claimed. A path that hand-rolls the bytes from a template gets past it. `lint/manifest-rules.test.ts`.

**G4.22 · E2E wait predicates describe the outcome.** Inside one `test()` body, a `waitForSource*`
predicate must describe the POST-operation shape; one already true on the loaded document returns
at once, and a gesture that silently no-ops passes. `e2e/lint/settle-predicate-vacuity.test.ts`.

**G4.23 · Requirement and spec lockstep.** Every spec under `e2e/tests/` pairs with a requirement
file under `e2e/requirements/` and vice versa (`.perf` stripped from the stem, no two specs claiming
one file); each requirement carries a title, a section and a scenario, and Playwright lists at least
one test for each spec. A requirement list three times longer than the spec's
`playwright test --list` count needs a reason in the scan's allowlist; the counts needn't match.
`e2e/lint/requirement-spec-lockstep.test.ts`.

**G4.24 · A block's write rule runs in the content write.** Every content write goes through
`tree-operations/content-write.ts :: legalizeWrite`, which runs the kind's `rawWrite`, then its
container's `bodyWrite`, and hands back the caret moved to where the rule left it, so a code fence
is grown or closed whichever gesture wrote it. It's a type: `updateNodeContent` only takes bytes that
went through `legalizeWrite`, or plain text it runs through it.
`test/editor-actions/content-write-caret.test.ts`.

**G4.25 · No `import.meta` env reads.** Nowhere under `src/lib`, test tree included: it's
Vite-only, so the library wouldn't load under another bundler (and `svelte-package` warns on it
wherever it sits). Toolchain flags come from `esm-env`, imported only by `src/lib/env.ts` (a row of
`lint/file-rules.test.ts`), and every dev-only check asks `isDevChecks()`, so
`configureEditorEnv({ isDev: true })` turns the checks and the dev warnings on together. The
reference plugins and the consumer example are Vite apps and exempt. `lint/suite-file-rules.test.ts`.

**G4.26 · Comment budget.** Two scans. Length: a comment block gets two text lines and a header
five. A header is a file's first comment, a docblock right above an `export interface` or
`export type`, or a docblock on an export (or one of its members) of a published entry point
(`index.ts`, `plugin.ts`, `testing.ts`, `editor-props.ts`, `block-component.ts`). Section dividers
and tool directives don't count; `lint/comment-lines.ts` reads the blocks and holds the header rule.
Vocabulary: the house words (listed in the scan; `docs/contributing/glossary.md` says what to write
instead) appear in no comment, backticked symbols aside, and in no requirement file's body text;
every design and contributing doc holds a baseline of its own that a rewrite can lower and nothing
can raise. A why that needs more lines or a private word belongs in a design doc or plain English
(`docs/contributing/code-style.md` § Comments). `lint/comment-budget.test.ts`,
`lint/comment-house-words.test.ts`.

**G4.27 · Parse-scope declaration.** Every call of the core `parse` entry outside `core/parser.ts`
passes an explicit `scope`. The default is `'document'`, so a fragment caller that forgets hands one
block's bytes to the openers as a whole document, and only the caller knows which it is. The
consumer example and the published kits are excluded (they parse whole documents).
`lint/call-site-rules.test.ts`.

**G4.28 · Leaf raw writes outside the content write.** Every `<node>.raw =` statement outside
`tree-operations/node-primitives.ts` (home of `writeOwnRaw` and `installOwnRaw`) is on a counted
allowlist with the reason it can't reach a kind that declares a write rule, and an `installOwnRaw`
call counts too outside that file and the content write. Whether a listed route runs its bytes
through `normalizeOwnRaw` or `legalizeWrite` first is left to review. `lint/leaf-raw-write-rule.test.ts`.

**G4.29 · Hardcoded-chord manifest.** Every library file that reads a `KeyboardEvent` modifier flag
is named in `schema/reserved-chords.ts`, with the chords it claims outside the keymaps and the key
literals it compares (negated guards included), which keeps the public `reservedChords()`
(`editor-props.ts`) true. A manifested file keeps literal key comparisons and modifier reads: the scan
is structural, so a shared helper fails it until the scan learns that helper.
`lint/reserved-chord-manifest.test.ts`.

**G4.30 · Hidden-run classification.** One rule, two spaces. `core/inline/visibility.ts` states the
marker families and the hiding rule, and `caret/widget-offset.ts` applies it where there's a caret;
a third copy would disagree the day a mode moves, and a caret placed in unpainted text corrupts
silently. A property test holds the node-space and DOM-space answers together over one rendered
fragment. Two scans: resolving hiding state is allowlisted to those two homes plus readers asking a
different question, and every file naming a marker class in code is manifested with its role. The
runtime backstop is the dev probe in `invariants/marker-css-parity.ts`, which compares
`getComputedStyle` with the predicate once per mode change. `lint/manifest-rules.test.ts`.

**G4.31 · Retired upward.** The rule was: the pending marks (a format toggled at a collapsed caret,
waiting for the next insertion) are spent only where typed or composed text is written. They're one
of the caret memory's insertion records now (`caret/pending-marks.ts`), so the block's write, which
every insertion route goes through, is the only thing that spends them, and there's no method left
that reads and clears them. A spend anywhere else doesn't compile.

**G4.32 · Inline-cache one spelling.** Every non-render consumer reads the inline tree through
`resolvedInlineContent`, so the resolver and the signature travel together; dropping the signature
reads an entry the render path didn't fill (brackets where the screen shows a link). The raw
`getInlineContent` stays in its own module, plus the vertical-skip decision, which wants the
resolver-less answer. `lint/file-rules.test.ts`.

**G4.33 · Live-rewrite verification.** The modules that build live-mode byte candidates verify them
through the render path's own `renderedText`, never a private walk over the parse, and every file
naming an inline marker family in code is manifested with what it does with it (only the model
decides which spans a marker-hiding mode drops). Each verification states which reading it takes:
the block's own screen where it decides what a press may touch, or the content behind every marker
where it's a before/after diff, and the content reading declines any side whose chrome paints
(live-mode.md § 4.1). Every destructive join goes through `cleanJoinedRaw`, and the files naming
`preDelete` are a closed allowlist. `lint/manifest-rules.test.ts`.

**G4.34 · Link byte-write module.** The image rule's twin (G4.21): the GFM link serializer is named in
code only inside `link-source-bytes.ts` (`lint/file-rules.test.ts`), and only the documented write
paths name `buildLinkEditBytes` and `buildLinkUnwrapBytes`. Every candidate is verified through the
render path (G4.33), and a link an inline plugin kind claimed is declined, since there's no
`rewriteLink` hook. `lint/manifest-rules.test.ts`.

**G4.35 · Stamp and revealable parity.** A construct whose marker spans carry a `data-construct-*`
stamp declares `revealable: true` in the inline-construct policy table, and every revealable kind
stamps; the stamp list is derived from `core/inline-render.ts`. A stamp without a row reveals
nothing, and a row without a stamp addresses nothing. An absent row reads as `revealable: false`.
`lint/stamp-revealable-parity.test.ts`.

**G4.36 · Caret-write sites.** Every write to the native selection goes through the editor's caret
writer, `caret/widget-offset.ts :: createCaretWriter` (one per editor, on
`EditorServices.caretWriter`), which asks the drawn caret to repaint after each write (G4.143). A
caret goes through `placeCaretAtRaw`, which skips the marker prefix, never lands behind a hidden
marker run, and takes a required `clamp` (`reachable` or `exact`). A range goes through
`selectRawRange`, `extendSelectionToRaw` or `selectSurfaceContent`, and a caller holding the nodes
already (a widget whole) uses `selectDomRange`. The scan pins four file lists, each with per-file
reasons:

- the files calling a native selection writer, which is `widget-offset.ts` alone (the shapes are
  in `lint/native-selection-write.ts`, which G4.143 reads too);
- the files building a DOM position from a DOM-walk offset (`widget-offset.ts` and the readers
  that measure with it);
- the files naming `rawRangeToDomRange` (measuring and decorating only);
- the surfaces building `focus` from `placeCaret` (`selection/place-caret.ts`).

`lint/manifest-rules.test.ts`.

**G4.37 · Content-empty stamp parity.** The files rendering a fragment into a contenteditable the
caret walk reads (`renderInlineNodes`, `renderCodeBlock`) are exactly the files stamping
`data-content-empty`; a surface without the stamp paints a marker-only block as an empty line nobody
can reach. A file naming a renderer that mounts nothing carries a reason.
`lint/manifest-rules.test.ts`.

**G4.38 · Editable surface parity.** Every component mounting the text surface
(`createEditableSurface`) publishes each member of `src/lib/block-component.ts` ::
`EDITABLE_SURFACE_MEMBERS`, as an instance export or in the surface literal it hands
`publishRefSlot`. `BlockComponent` declares them optional, so a missing one compiles and silently
declines (every `editor.insertMarkdown()`, say). A `createEditableLeaf` leaf is G4.73's. Add a member
to the tuple and both rules take it. `lint/insert-door-surface-parity.test.ts`.

**G4.39 · Command surface parity.** Every component mounting the text surface
(`createEditableSurface`) publishes `runCommand` as an instance export, since that's where the
built-in text commands live; it's optional on `BlockComponent`, so a missing one compiles and
declines every built-in `editor.runCommand()`. The two reorder ids resolve in the dispatch and don't
count. `lint/file-rules.test.ts`.

**G4.40 · Rewrite-claim set parity.** Three lists name one set of rewrites: the ids built-in keymaps
bind to a rewrite over one block's selection, the ids the dispatch answers specially over a
cross-block range (`RANGE_DECLINED_COMMAND_IDS` declines, `CROSS_BLOCK_RANGE_COMMAND_IDS` routes),
and the chords `selection/cross-block/keydown.ts` claims; each rewrite id sits on exactly one of the
two dispatch lists. Membership is listed by hand, not by prefix (`link.openCard` isn't `format.`).
`test/selection/cross-block/rewrite-claim-parity.test.ts`.

**G4.41 · Warn-gate bypasses.** No file under `src/lib` mocks `dev-warn` or spies `console.warn`:
a mocked `devWarn` never reaches the sink, a console spy reads a channel the sink silences, and a
spy that swallows the call hides Svelte's runtime warnings too, so the gate goes blind for that file.
The one file whose subject is `devWarn`'s console output is allowlisted.
`lint/suite-file-rules.test.ts`.

**G4.42 · Separator-write sites.** No module writes a sibling's `leadingTrivia` by hand. A splice
fixes its separators through one route (`settleEdit` in the commit steps, `updateNodeContent` for a
write no commit follows, `spliceChildrenSettled` under the path-addressed entries), and the allowlist names each exemption
with its reason (`node-ops.ts`, `content-write.ts`, `node-primitives.ts`, `chain-rebuild.ts`,
`reorder.ts`, the item moves under `list/`, paste replacements, and three sites a splice window
can't infer, such as the gap-caret insert). Every blank-line write the fix-ups make goes through
`tree-operations/separator-writes.ts` (`writeSeparator` or `writeWrapSlot`), which drops the
owner's child spans first, and the fix-ups take a `BodyParent`, so none loses track of whose
fence lines it's reading.
`lint/separator-write-doors.test.ts`.

**G4.43 · Split-landing parity.** Every file naming `splitNode` reads `secondHalfIndex` at least
once per split CALL, so a caller growing a second split whose caret it puts at `i + 1` fails too,
and marks that landing `fresh`, so Enter starts the new block plain. `lint/split-landing-parity.test.ts`.

**G4.44 · Live ranged-edit parity.** Every editable prose surface resolves native ranged edits
through `components/blocks/text/live-selection-edit.ts :: resolveLiveRangeEdit`, by building the
shared typed-input step (`components/blocks/text/typed-input.ts :: createTypedInput`), the one
other file that calls it. A destructive input carries its range on the event (`getTargetRanges()`), not in the
selection, so a surface reading only its selection lets word, line and drag deletes cut through
delimiter runs. The fenced-code surface is outside the set (no inline constructs).
`lint/file-rules.test.ts`.

**G4.45 · Settle coverage for bare tree ops.** `splitNode`, `deleteNode` and the two merge entries
splice a body without fixing its separators, so every file importing one is declared with the commit
that does, and must reach a commit or a settle entry (keyed on the import, so an alias still counts).
A caller outside the commit leaves the document one folded line short of its own reload, silently.
`lint/manifest-rules.test.ts`.

**G4.46 · Ancestry fold-sink stance.** `rebuildUnsharedChain` and `rebuildUnsharedAncestry` take a
required-nullable `folds` sink: passing one claims "I can reconcile the parent's ids and refs", and
`null` declines. Every production call site is listed with its stance and why, since a wrong id
length is permanent. `lint/ancestry-fold-sink-thread.test.ts`.

**G4.47 · Editing-host readers.** Every `[contenteditable]` selector read and every
`document.activeElement` identity read goes through the host-aware predicate or declares its own
answer with the reason. The hidden host is a real contenteditable that paints nothing, so a read
that forgets it answers for the wrong element. `lint/file-rules.test.ts`.

**G4.48 · Wall-clock budgets.** An absolute `performance.now` or `Date.now` budget reds on a loaded
host, so outside the perf projects every wall-clock budget goes through the growth harness, whose
N-vs-4N ratio (`measureScanGrowth`) cancels the machine. The allowlist carries a reason per file.
`lint/suite-file-rules.test.ts`.

**G4.49 · The shared IME driver.** A spec that builds a `CompositionEvent`, an
`insertCompositionText` input event or a key event saying `isComposing: true` by hand tests a
browser no user has, so it fails the scan. The
driver file is the one exemption (WebKit has no CDP session), pinned exactly, so a widened exemption
and a deleted WebKit branch each fail. `e2e/lint/e2e-drivers.test.ts`.

**G4.50 · Cross-block-range classification.** Every block command id is range-declined, has a
cross-block branch, or is recorded range-safe with its reason; the decline is what stops a command
spending one block's offsets against a multi-block range. `lint/range-command-census.test.ts`.

**G4.51 · Debounced-checkpoint pairing.** A file pushing a typing checkpoint also arms the pause
window; a push with no arm leaves a batch no pause can end, and one Ctrl+Z unwinds the session.
`lint/file-rules.test.ts`.

**G4.52 · Content-version announcements.** The content version is announced at each place that
writes document bytes, never derived from a walk, so the writers are a declared set: the commit
covers its structural writers, and the typing writes, the history swap and the `source` swap answer
for themselves. A silent writer serves every whole-document memo a stale answer. The scan also holds
each writer except the `source` swap to asking the reading-mode check
(`editor-actions/commit/reading-write-gate.ts`) in every function that writes.
`lint/content-version-doors.test.ts`.

**G4.53 · Descriptor-field roster.** `BlockKindDescriptor` and the field reference table in
`docs/design/plugin-contract.md` are one set, both ways, keyed on the field-name column. The scan
reads `schema/block-kind-descriptor.ts :: DESCRIPTOR_FIELDS`, which is complete by compile error.
`lint/descriptor-field-census.test.ts`.

**G4.54 · Entry barrels are import sinks.** No module in a published entry's own import closure
imports that entry back: a consumer's bundler could split the cycle and run the entry before its
imports, and in-repo `#lib` never shows it. The entry list derives from package.json `exports`, and
the consumer example's build fails on such a cycle too (`examples/consumer/vite.config.js`).
`lint/entry-barrel-sink.test.ts`.

**G4.55 · The package name.** Docs name the package `@voithos-labs/aragonite`, never the bare
`aragonite`, which belongs to an unrelated npm package. `docs/changelog/` is exempt, since it
records what shipped under the name of the day. `lint/doc-package-name.test.ts`.

**G4.56 · Iterative walks.** No function under `core/inline/`, `caret/`, `windowing/`, `ambient/` or
`components/blocks/text/` that reads a node's `children` or `childNodes` sits on a call cycle, even
through helpers. Inline nesting depth is up to the input, so recursion overflows the stack and
strands the block in the failed-block fallback; write the walk with an explicit stack. The scan
resolves a call to every declaration of that name, so two walkers spelled alike can't hide each
other (and a repeated spelling fails outright). The exception map is empty by design.
`lint/inline-walk-iterative.test.ts`.

**G4.57 · The lexer differential.** The source-scan lexer (`spanAt`) classifies every character of
each scanned `.ts` file and `.svelte` script block as comment, string, template, regex or code, and
must agree with TypeScript's own scanner; a literal it misreads would silently shrink every scan
that reads code through it. `.svelte` markup and `.css` files, which TypeScript can't lex, are pinned
against a corpus instead. `lint/scan-source.differential.test.ts`.

**G4.58 · Commit-message shape.** `scripts/lint-commit-message.mjs` holds the only definition of
the subject shape, and both the `commit-msg` hook (`.githooks/`, wired by the `prepare` script) and
a step in CI's `unit` job call it. Line 1 carries the whole summary within 72 characters, since
`git log --oneline` joins a multi-line first paragraph; per-change lines go below a blank line. The
scan reads the `prepare` wiring, the hook and the CI step. `lint/commit-message-shape.test.ts`.

**G4.59 · The VR tag roster.** The windowing-hazard catalog in `docs/design/virtual-rendering.md`
and the tags cited under `src/` are one set, both ways, keyed on the tag column. The corpus (library,
styles, e2e requirement files) is read as raw text, since a citation is almost always a comment.
`lint/vr-tag-census.test.ts`.

**G4.60 · Spread-into-call declarations.** Every spread into a call's argument list in shipped source
is declared with what bounds its count, since a list past the engine's limit throws "Maximum call
stack size exceeded" at the call. A `bounded` row names its ceiling (`MAX_UNDO`, the parser's
nesting cap, the `spliceMany` chunk); a `gap` row says the count follows the document, which names a
defect. A splice a paste can scale goes through `src/lib/tree-operations/splice-many.ts` ::
`spliceMany`. Array-literal spread and rest parameters are out of scope. Rows key on file plus
enclosing function. `lint/spread-call-census.test.ts`.

**G4.61 · The production commit scope.** `invariants/commit-scope.ts` imports no build flag and
writes its depth counter at plain statement position. The scope defers the decoration engine's
in-commit `invalidate()`, so a `DEV` guard on it would break production alone, and `esm-env` reads
DEV as true under vitest, where no behavior test could see it. `lint/commit-scope-production.test.ts`.

**G4.62 · Text contrast.** Every `--code-tok-*` color in `editor-theme.css`, the grey text tokens,
the done-or-inert greys, every marker colour at `--syntax-marker-dim`, and faded raw-block text
clear WCAG AA (4.5:1) in both themes against `--color-surface`, the fence background, and (for UI
greys) `--color-bg`, compositing any opacity first. It's computed from the declarations because the
editor paints no background of its own, so axe would measure the host's palette. The code family is
derived by prefix (a new token is measured), and an unparseable value fails. The grey, marker and
done-or-inert families and the faded blocks are named lists in the test, so a new text token in one
of them needs its own row there. `lint/code-token-contrast.test.ts`.

**G4.63 · Bundled-plugin test boundary.** Every file under `src/lib/test/plugins/<plugin>/` imports
only a published entry point (any the exports map lists, `#lib/svelte.js` included), its own plugin's
source, another plugin's published subpath, the copyable test support, a relative path outside
library code, or an npm package. A deep `#lib` import names something the testing entry point is
missing; each allowlist entry names it, and a dead entry fails. `lint/bundled-plugin-test-boundary.test.ts`.

**G4.64 · The tree-ops layering.** `node-primitives.ts`, `unshare.ts`, `separator-writes.ts`,
`neighbour-merge.ts`, `settle.ts`, `content-write.ts`, `stored-as.ts`, `leaf-range.ts`,
`node-ops.ts` and `chain-rebuild.ts` import only downward, in that order. An import cycle passes every behavior test and `svelte-check`, so only a
source scan holds it. `lint/tree-op-ladder.test.ts`.

**G4.65 · Delimiter auto-pair parity.** Every editable prose surface (G4.44's set) routes its
`beforeinput` through
`src/lib/components/blocks/text/delimiter-autopair.ts :: applyDelimiterAutoPair`, by way of the same
typed-input step, so what a typed delimiter writes and where the caret ends up has one answer.
`lint/file-rules.test.ts`.

**G4.66 · Relative scroll through `scrollBy`.** A correction that moves the scroll position by a
delta calls `Scrollport.scrollBy`, never `setScrollTop(scrollTop() + delta)`: the browser snaps a
fractional write to a device pixel, and only `scrollBy` carries the lost fraction into the next call.
`lint/file-rules.test.ts`.

**G4.67 · Menu presence census.** Every open menu is in one registry
(`components/menu/menu-presence.svelte.ts`): a menu joins by attaching `menuPresence.track(close)` to
its root element, so `menuChange` reads it open while mounted and `closeAll` (called by a document
swap and a mode change) can close it; the close is told which, so a draft is saved on a mode change
and dropped on a swap. Every menu element (the shared menu class, or a menu, listbox or dialog role)
carries that attach in its opening tag, or is listed with the reason it doesn't. A menu whose rows
write also passes `{ edits: true }` (unchecked), and one that mounts in reading mode anyway closes at
once and warns `menu-opened-in-reading`. `lint/menu-presence-census.test.ts`,
`components/menu-presence.test.ts`.

**G4.68 · Registry reads take the editor's grammar.** The inline syntax, widget kind, directive and
completer registries are process-wide, and the editor's grammar leaves out a plugin its `plugins`
prop didn't list. Every internal reader takes the grammar, or the whole `Reading`
(`src/lib/schema/reading.ts`: grammar, link resolver, mode), as a required parameter. A fallback to
every installed plugin is spelled only in the listed places, and a write that reparses a block the
editor drew reads with the link resolver it was drawn with. `lint/registry-view-reads.test.ts`.

**G4.69 · The defaulted readers stay at the edge.** The published `parse` and `parseInline`, and the
plugin barrel's `computeInlineContent`, read every installed plugin when no grammar is given. Code
inside the library calls `readBlocks` and `readInline`, which require one; only the public entry
points, the test kits and listed editor-free code may import the defaulted readers.
`lint/registry-view-reads.test.ts`.

**G4.70 · Decorations keep off the editor's attributes.** A block decoration can set attributes on a
block's own element (a block host, a list item's box, a table row or cell), and a `data-` name the
editor uses there would answer the editor's lookups or paint a state it never set.
`src/lib/decorations/reserved-attrs.ts :: RESERVED_BLOCK_ATTRS` must match exactly the names the
scan finds on those elements' tags, in `closest()` lookups, and in stylesheets reading them (an
`attr()` paint included), so a name used only inside a block stays free.
`lint/reserved-block-attrs.test.ts`.

**G4.71 · Blank means spaces and tabs.** GFM (§ 2.1) calls a line blank when it holds only spaces
and tabs, but `String.trim()` drops every Unicode space, so an emptiness rule built on it deletes a
typed non-breaking space. Test document text with `src/lib/core/lines.ts :: isBlankText`; the scan
fails `trim()` as an emptiness test elsewhere, except for strings no document holds and the math and
mermaid blocks' "does the render draw anything". `lint/file-rules.test.ts`.

**G4.72 · The grammar's whitespace is GFM's.** Where a rule wants spaces or tabs, it says `[ \t]`;
where the spec says whitespace, it means the ASCII set of § 2.1
(`src/lib/core/lines.ts :: isWhitespaceChar`). JS `\s` and `trim()` admit a non-breaking space, so
the scan fails both in `core/parsers/`, `core/directive/`, the other grammar files and the bundled
plugins (which read the helpers through `src/lib/plugin.ts`). Emphasis is outside it (its flanking
rule is Unicode), and the allowlist carries a reason per file. `lint/file-rules.test.ts`.

**G4.73 · A leaf component exports `blockApi`.** Every component calling `createEditableLeaf`, test
fixtures included, exports `blockApi` and no `BlockComponent` member of its own. A flat copy out of
the factory's object still compiles while dropping what it skipped (no `insertMarkdown` means every
`editor.insertMarkdown()` declines). The scan reads the member names off `BlockComponent`'s
declaration, so a new member joins it. `lint/leaf-block-api-export.test.ts`.

**G4.74 · The open last line has one writer.** The walk that adds or drops the ending on a block's
last line, through every container holding it, is private to `tree-operations/open-tail.ts`, and only
the commit's two steps call it (G1.41). A route that ended the tail itself would be the rule's second
copy. `lint/file-rules.test.ts`.

**G4.75 · One leaf write.** New text for a leaf is written one way at every depth: a commit through
`src/lib/editor-actions/block-edit-core.ts` :: `commitLeafText`, or the keystroke's in-place write,
`src/lib/editor-actions/leaf-write.ts` :: `writeLeafInPlace`. Each step of the write has a short list
of files allowed to name it (an aliased import counts):

- the content write with its fix-up (`updateNodeContent`): the in-place write, the keystroke's
  trial reparse, the container-matching paste and the format toggle over several blocks; the
  commit uses the write alone and fixes it up itself (G4.208)
- a write in place that skips the reparse (`writeOwnRaw`, `installOwnRaw`): table cells and find
  and replace's private copy
- the document as an owner-less body (`documentBody`), plus the trial reparse's throwaway copy
- the task-marker reconcile: the content write, the join and `replaceBlock`
- a replacement's escape for its container: `replaceBlock` alone
- the typing batch (push, join, pause): `typeInLeaf` alone
- the chain-depth check (G1.20): the in-place write alone

A route copying any step fails with that step's reason. The content version and the join have their
own scans (G4.52, G4.76). `lint/leaf-write-doors.test.ts`.

**G4.76 · Joins into a leaf.** Two texts joined into one leaf go through
`src/lib/tree-operations/node-ops.ts` :: `joinIntoLeaf` (the join cleanup in
`leaf-range.ts :: joinLeaves`, the kind's and container's rules, and a reparse). The scan declares
every file calling `joinIntoLeaf` or naming `cleanJoinedRaw`, and reads the text each file hands a
leaf (a `.raw =`, or a leaf write's argument, followed to its value): text built from more than one
source is a join, so its file names the cleanup or is listed with why it isn't (a paste inserting
between one leaf's own halves). `lint/cross-node-join-doors.test.ts`.

**G4.77 · One way to belong to no plugin.** `src/lib/schema/plugin-install.ts` :: `registerAsCore`
runs registrations as if no plugin were installing. Its callers:

- `src/lib/components/editor-built-ins.ts` :: `registerEditorBuiltIns`, the editor's own bootstrap,
  which the test reset keeps
- a registry's `registerCore`, for a built-in key the registry can't recognize itself (a code
  language, a context-menu row), also kept by the reset
- `activateDirectives`, around the directive grammar, which the reset drops
- `registerBuiltInDescriptors`, and the editor modules that register at load (the built-in global
  commands, the default paste surfaces, the table's Enter completer, the core inline widgets)

The scan matches the bare name, so an aliased import is caught at its import line.
`lint/file-rules.test.ts`.

**G4.78 · The editor's built-ins come in one way.** `registerBuiltInBlocks`,
`bootstrapCodeLanguages` and `registerDefaultContextActions` are called only from
`src/lib/components/editor-built-ins.ts` :: `registerEditorBuiltIns`, which runs them as no plugin
(G4.77). Called anywhere else, whichever plugin's setup gets there first owns the paragraph component
or the code languages. Shipped source only; unit tests may call the bootstraps directly.
`lint/file-rules.test.ts`.

**G4.79 · One way to ask whether it's a grid.** Ask through
`src/lib/schema/block-kind-descriptor.ts` :: `isGridKind` (or `isGridDescriptor` with a descriptor in
hand). Any other file with a `'grid'` string in its code fails, a list check like
`['strip', 'grid'].includes(contract)` included; declaring the contract, naming it in the type,
`role="grid"`, and the insert menu's search keyword are left alone. `lint/file-rules.test.ts`.

**G4.80 · One answer to what a range covers.** The delete, the copy, the format toggle and the
overlay read a `RangeCoverage` off a `CoveredRange`, both classes with a private field built only by
`selection/range-coverage.ts :: coverRange` and `rangeCoverage`, so a hand-built one doesn't compile.
The scan covers the other way to grow a second answer: in `selection/`, only `range-coverage.ts` and
the caret walks in `path-lookup.ts` and `caret-target.ts` call `isCollapsedContainer` or
`collapsedContainerHiding`. `lint/file-rules.test.ts`, `eslint.config.js`.

**G4.81 · One table row snap.** A cross-block range with a table endpoint takes that table's rows
whole. `snapCrossBlockTableEndpoints` runs in `coverRange` for the delete, the copy and the
overlay, and in the selection state's stored `start` and `end`, which the collapse keys, the undo
seed and the extension paths read.
`lint/file-rules.test.ts`.

**G4.82 · The task-marker rule has one home.** `reconcileTaskMetadata` is named only in
`tree-operations/list/reconcile-task.ts`, where `writeKeepingTaskMarker` calls it. Every file that
writes into a child slot (through that wrapper or in place with `writeOwnRaw`, `installOwnRaw`) is on
one list with its role: the content write, the leaf join, the block replace and a range delete's
survivor wrap their write, and the rest say why they need no wrapper (a table cell holds no list
item). A file listed as wrapping must call the wrapper. `lint/leaf-write-doors.test.ts` (the G4.82
and G4.82b rows), with G1.42 as the runtime half.

**G4.83 · Every plain read says why.** Nodes built from bytes reach the tree the way a reload
builds them, through `schema/opened-reading.ts :: readAsOpened`, which gives every container that
must hold a child an empty paragraph; `schema/container-raw.ts :: parseContainerRaw`, a container's
re-read of its own bytes, goes through it too. Bytes written into a child slot are read the way a
reload reads them there, through `tree-operations/list/task-paragraph.ts :: fragmentReaderAt` (in a
list item's first slot, behind its whole marker line), or `slotReaderAt` and `childSlotAt` for a
caller holding only a path. Those read plain, so a caller that installs what they read fills in at
the splice. Any plain reader (`readBlocks`, `parse`, `parseTaskItemBody` or a slot reader) outside
`core/` and `testing/` is listed in the manifest under one of four kinds: a probe that installs
nothing, a read whose file fills in before it installs, the opened reading itself, or a read handed
to a route that fills in at the splice. A file declared as installing must call the fill-in itself.
`lint/manifest-rules.test.ts`.

**G4.84 · One place says where a leaf's bytes are stored.** A `StoredAs`
(`src/lib/schema/stored-as.ts`) answers four things about a position: block or plain text (a table
cell), the bytes its write rules would keep, how a reload reads them there, and what a write
installs. It's a branded type built only by `tree-operations/stored-as.ts :: storedAsAt` and
`storedAsIn`, from the tree, so nothing reads a candidate behind a hand-written copy of a
container's marker. `lint/file-rules.test.ts` holds the `as StoredAs` cast to that file.

**G4.85 · A removing rewrite reads through the store.** The join cleanup and the edge delete read
every candidate through `core/inline/live-edit/read-back.ts :: readBack` with G4.84's store (a
required field of their query), never a parse of their own, since a top-level read forgets the
container the bytes land in. `lint/file-rules.test.ts` keeps `readBlocks` and `parse` out of every
`.ts` module in `components/blocks/text/` and `core/inline/live-edit/`, and
`test/tree-operations/store-routes.test.ts` runs every place a store is made on bytes a lone
paragraph's store reads differently, failing a store made where no row runs.

**G4.86 · The list marker has a short list of readers.** Reading a list item's marker off its
metadata (or off a parse cast to carry one) is for the code that builds, renumbers, draws or
dumps a list. A rewrite that wants to know how its bytes read under the marker asks the store
instead. `lint/file-rules.test.ts`, with each reader and its reason.

**G4.87 · One writer of the scroll position.** Every write to the editor's scroll position lives in
`windowing/scroll-owner.ts`, which decides who owns the position first (the browser's anchoring, a
held scroll into view, or the height correction). Every other module gets a `ScrollportReader`,
which has no write method (pinned with `@ts-expect-error`). The scan catches the rest: `scrollTop`
assigned, `scroll`/`scrollTo` given a position, `scrollBy`, `setScrollTop`, `scrollIntoView`, or
opening a writable port, anywhere but the owner and the port (`rects.scrollTo(path)` goes through the
owner and passes). Two more rows list the `scrollToMount(` callers and, inside the owner, who writes
the port (`writeScroll` and the measure round's correction). The few files keeping writes of their
own (a drag's autoscroll, two listboxes) say why. `lint/file-rules.test.ts`.

**G4.89 · One in-leaf range replace.** Replacing a range of one leaf is
`tree-operations/leaf-range.ts :: replaceRangeInLeaf`: it cuts back to the painted text, moves both
ends off any surrogate pair, and cleans the join; joining two leaves is `joinLeaves` beside it. The
scan holds `snapToScalarBoundary(` to `leaf-range.ts`, the split's two cuts
(`node-ops.ts :: cutPastLineEnding`, `structural-suffix.ts :: cutKeepingStructure`),
`selection/char-endpoint-snap.ts` and `core/lines.ts`; `joinLeaves(` to `leaf-range.ts` and the
merge in `node-ops.ts`; and fails a hand-written splice of one leaf's bytes
(`raw.slice(0, a) + … + raw.slice(b)`) in the live editing paths unless the file says why (the range
delete and typing after a cross-block delete are known gaps). `lint/file-rules.test.ts`.

**G4.90 · A paste cuts like typing.** Pasting over a selection inside one block writes what typing
the same text over it writes: every file naming the paste's range (`preDelete`) cuts it through
`replaceRangeInLeaf` with the pasted text, or says why not (the code block's paste stays a literal
splice). `lint/file-rules.test.ts`.

**G4.91 · A focus call scrolls nothing unless it says why.** `focus()` scrolls an off-screen element
into view by itself, a scroll G4.87 can't see, so a caret's focus passes `preventScroll` and asks the
scroll owner instead. The scan flags `focus()` with no arguments or without `preventScroll` (a block
component's `focus(offset)` passes), and every flagged file is declared with its reason; the manifest
is per file. `lint/file-rules.test.ts`, with G1.45 as the runtime half.

**G4.93 · One pick of the block a round keeps still.** Which block stays still across a measure round
is picked once for the document, level by level (`windowing/list-tree.ts :: createListTree`, each
level through `windowing/steady-block.ts :: heldBlock`), and the scroll owner corrects only by the
branded distance `heldDelta` makes, so a hand-made distance or block doesn't compile
(`test/windowing/steady-block.test.ts`). The scan holds the brand casts to `steady-block.ts` and
every `compensate`, `heldBlock` or `heldDelta` call to its declared file, function and count.
`lint/file-rules.test.ts`.

**G4.94 · The editor's own selections have one store and one set of writers.** A gap caret and an
inline widget selected whole are written only through `selection/place-caret.ts` (`placeGapCaret`,
`selectWidgetWhole`), which clear the browser's range in the same batch, and a selected widget is
held only in `selection/selection-state.svelte.ts`. A `.setGapCaret(` or `.selectWidget(` call
elsewhere fails, and so does a `$state` cell typed `WidgetTarget` outside the store; readers ask the
store (`widget`, `widgetIn`, `widgetRange`). `lint/file-rules.test.ts`, with G1.46 as the runtime
half.

**G4.95 · What a range covers is decided once.** `selection/range-coverage.ts :: rangeCoverage`
says which edges a range keeps, which subtrees it holds whole and which table cells, and the delete,
copy, format toggle, overlay and table cell painting read that. The helpers that work it out (the
in-between walk, rectangle bounds, closed-unit checks, table-endpoint cell math) are called only in
`range-coverage.ts`, their defining files, and a short list of cell edits with reasons.
`lint/file-rules.test.ts`.

**G4.96 · A commit rebuilds each container once.** After `commitMultiScope` runs its mutation, it
rebuilds every child list it was handed and each container above, up to the top level, so a mutation
that rebuilds its own scope (or above) gets that container rebuilt twice. Container rebuild calls
live in `schema/`, `tree-operations/chain-rebuild.ts` and `tree-operations/unshare.ts`; any other
caller is listed with why no commit repeats its rebuild, counted per name. Three honest exceptions
are listed as such (an item merge's list, a pasted list merge, the range delete across containers).
A mutation needing a node's bytes early (a Tab's new sublist) calls `ContainerScope.rebuild`, which
warns in dev if that node is the scope, above it, or still shared with an undo entry. When several
child lists share a container, it's rebuilt once, after everything below it
(`src/lib/tree-operations/chain-rebuild.ts :: sharedChainLevels`). `lint/container-rebuild-homes.test.ts`;
`editor-actions/commit/commit-rebuild-once.test.ts` counts rebuilds per node, and
`tree-operations/chain-rebuild-shared.test.ts` covers a line one chain spills into a later chain's
list.

**G4.97 · One way a child's height reaches its list.** A block, a list item and a table row each
measure through `windowing/use-measured-child.svelte.ts :: useMeasuredChild` (at mount, after an edit,
on a resize), and the list writes the height only in its private `applyMeasured`, keyed by the
child's id. No list reports its own height upward. The scan counts every table write, cache write and
registration by file and function, and keeps the measure channel's key to its defining file, its
provider and the hook. `lint/file-rules.test.ts`, with
`test/windowing/measured-child-routes.svelte.test.ts` running every child kind through every trigger;
G1.47 is the runtime half.

**G4.98 · One place throws measured heights away.** Only
`windowing/layout-state.svelte.ts :: createLayoutState` drops measured heights: a new document or a
mode flip calls `forgetMeasuredHeights` (leaving the width version alone, or every list rebuilds and
loses the held block), and a width or font-size change calls `rebuildForNewGeometry`, which bumps
it. Layout state hands out the height estimator without `dropMeasured`, and two scans in
`lint/file-rules.test.ts` fail a second estimator (or a cast back) and a width-version write
elsewhere. `test/windowing/height-lifetime-routes.svelte.test.ts` runs all four routes and the three
changes that keep the heights.

**G4.99 · A windowed list keeps its table height while blocks mount.** Svelte mounts newly windowed
blocks one at a time, and a layout read in between sees a short list (at the document's end the
browser pulls the scroll up for good). So every component rendering spacers calls
`windowing/use-window-floor.svelte.ts :: useWindowFloor` on the box around them, holding it at the
table's whole height until the render ends. `lint/file-rules.test.ts` fails a spacer component
without it; `e2e/tests/plugins/view-swap-end-scroll.spec.ts` drives the swaps (VR-16).

**G4.100 · A block's own line ending.** When a block's editable element writes its own text, it
hands the list the new text plus the ending the block already had, so a document saved without a
final break keeps none. That lives in `components/blocks/editable/surface-write.ts` (`writeText`, and
`withOwnEnding` for routes not on it yet). New text takes the block's own ending, else the
document's, picked today in two places: a typed or completed line break reads the getter
`editable-surface.ts :: lineEnding`, and the code block's dissolve (`code-context-actions.ts :: run`).
`lint/call-site-rules.test.ts` fails a `trailingLineEnding` or `ownTrailingLineEnding` call under
`components/blocks/` outside those places (allowlisted by function), and a read of the getter
anywhere but a typed line break or a check that writes nothing.

**G4.101 · A typed write asks for itself.** The kind cue and the on-type completer answer typing,
never a command, a paste or a repair. Only `surface-write.ts :: writeText` asks them, for a write with
the `typed` intent. `lint/file-rules.test.ts` fails an `afterTypedWrite` or `completeLineOnType` call
under `components/` or `selection/` anywhere else, and `blocks/editable/surface-write-intent.test.ts` checks
which intents ask.

**G4.106 · Retired upward.** The rule was: a spec reloads the editor's own text through
`reloadContent`, since a `source` write equal to the text the editor holds changes nothing. The test
page's `__test.setSource` (`src/routes/test/editor/test-probes.ts`) now loads every write as a fresh
document (through `HarnessSource`, `src/routes/test/editor/harness-source.svelte.ts`), and throws when
the editor never replaced its document, so `loadContent(await getSource())` really reloads.

**G4.107 · An `edit` fires at its write.** A commit, a keystroke written in place, undo and redo,
and a replace-all each emit `edit` as their bytes land; nothing holds one back, since a held one fires
against whatever document is there by then. `input` also promises the block kept its kind
(`components/link-reference-map.ts` relies on it), so only the in-place write
(`editor-actions/leaf-write.ts`) declares it. `lint/edit-emitters.test.ts` keys each emit on its
function.

**G4.108 · One replace for every destructive gesture over a range.** Backspace, Delete, cut, typing,
an IME composition, paste and a command key over a cross-block range all go through
`selection/cross-block/range-replace.ts :: replaceRange`, which picks the removal from the coverage
and keeps the gesture one undo entry with one landing. `rangeDelete`, `removeHeldWhole`,
`commitGridLineDelete` and opening an `undoStep` under `selection/cross-block/` are allowed there only;
the range indent (`selection/cross-block/range-indent.ts`) opens its own step, since it removes
nothing. `lint/file-rules.test.ts`.

**G4.109 · A rebuilt container starts from its source's bytes.** A strip rebuild keeps a line by
pairing it with the container's previous bytes, so a container built around another's children (the
quote an alert leaves after a lift) starts with that container's `raw`; with an empty `raw` its first
rebuild respells every line. `lint/fresh-container-bytes.test.ts` fails an object literal with both
`raw: ''` and `children` under `tree-operations/`, `editor-actions/` or `selection/`, outside a short
list of builders of genuinely new containers.

**G4.111 · One write for a block's own text.** A block's editable element changes its own text
through `components/blocks/editable/surface-write.ts :: writeText`, which gives undo the caret from before the
key, keeps the line ending, and puts the caret back. `lint/call-site-rules.test.ts` fails an
`updateBlockContent` call under `components/`, `selection/` or a plugin's code (`src/lib/plugins/`,
`src/routes/test/plugins/`) elsewhere, except the few listed by function that are still to move,
and the block's own edit actions in `editable-surface.ts`, which `writeText` writes through.

**G4.112 · An indent key over a range has one route.** Over a range, Tab, Shift+Tab and any key bound
to an indent command nest or lift every list item the range reaches once, through
`selection/cross-block/range-indent.ts :: indentRange`. Three rows hold it: the two item moves
(`tree-operations/list/item-moves.ts :: nestListItem`, `liftNestedItem`) are called only from a
caret's Tab in `editor-actions/list-context.ts` and from the range indent; a container's chords go
through `editor-actions/container-block-component.ts :: dispatchContainerChord`, which leaves a key a
live range owns to the range; and a range replace's command insertion is built only in
`selection/cross-block/keydown.ts`, which leaves Tab out. `lint/file-rules.test.ts`.

**G4.113 · Retired.** The rule was: a `$$` source's opener, body and closer are read only in
`src/lib/plugins/latex/math-shape.ts`. It still holds, as G4.131's `$$` row, which also fails a
closer search written by hand.

**G4.114 · One paint decision under a range.** Whether a block under a cross-block range paints one
box, its selected text, or nothing is `src/lib/selection/primitives.ts` :: `classifyBlockForSelection`
(and `blockPaintsWholeBox`), and whether the range spans blocks at all is `rangeSpansBlocks` in the
same file. `lint/file-rules.test.ts` fails a read of the coverage's roots, edges or an end table's
cell run outside `src/lib/selection/` (`rootHolding`, `coveredRootHolding`, the `wholeRoots`,
`coveredWhole`, `startEdge`, `endEdge`, `startCells`, `endCells` fields, dotted or destructured), and a
`pathsEqual` of a range's `start.path` and `end.path`. A bracket read gets past it.

**G4.115 · A cut writes its copy's payload.** Each kind of selection a block can copy has one
`ClipboardArm`, written where that selection lives (each block's clipboard code, and
`selection/cross-block/clipboard.ts` for a cross-block range); the shared parts are in
`components/blocks/editable/clipboard-step.ts`. `runClipboardCut` runs the arm's own copy before anything
waits, then its removal, so a cut can't write different bytes from a copy; there's no cut payload
type, and an `async` copy doesn't type-check. `lint/call-site-rules.test.ts` fails a `.setData(` call
in production code outside those copy functions, `clipboard-step.ts :: writeShownSelection` (the
browser's own selection string, for reading mode, an unclaimed copy, and the code block) and the
menu's paste event.

**G4.116 · The pending break hears a key first.** Shift+Enter at the end of a text block opens a
line and writes nothing; Backspace and ArrowLeft take it back
(`components/blocks/text/pending-break-keys.ts`). The shared keymap's ArrowLeft would leave an empty
paragraph with the line still open, so the pending break asks first. The rows in
`e2e/tests/presentation/pending-break-keys.spec.ts` are the guard, and
`lint/pending-break-key-order.test.ts` fails when `TextEditableBlock.svelte`'s keydown calls the
shared keymap before the pending break.

**G4.122 · The directory import graph.** Every production import under `src/lib` goes into a graph of
top-level directories (and root files as nodes of their own), runtime edges kept apart from
type-only ones. The graph matches the edges in `lint/directory-layering-baseline.ts`: a new edge
fails naming the imports behind it, and a listed edge that's gone fails until its line is deleted.
The scan can't refuse a line someone adds, so a new baseline line gets a reviewer's eye. Two runtime
cycles are still listed, {`core`, `schema`, `caret`, `windowing`, `invariants`, `tree-operations`,
`debug`} and {`selection`, `editor-actions`}. Unconditionally, nothing in `tree-operations/` imports
from `editor-actions/` or `components/`, and an unresolvable import fails.
`lint/directory-layering.test.ts`.

**G4.123 · An item's children leave it under the order check.** Backspace's unwrap of a list's first
item and Enter in an empty outermost item both dissolve the item through
`tree-operations/list/item-partition.ts` :: `dissolveItem`, which splits its children inside G1.61's
check. Three rows in `lint/file-rules.test.ts`: the splitter `itemPiecesInOrder` is called in that
module only, each call sits inside `keepingListOrder(…)`, and
`tree-operations/list/list-builders.ts` :: `assembleListHalf` is called only there and in the paste
break-out.

**G4.125 · One reading of a block's widgets.** The widgets a prose block draws include ones a link or
emphasis wraps, which the top-level inline list doesn't show.
`src/lib/components/blocks/text/widget-adjacency.ts` :: `widgetsIn` lists them all, and the
widget-edge click, the caret painted there, the arrow keys at a widget edge and every selected-widget
reader ask it (`findFirstEdgeWidget` and `findLastEdgeWidget` beside it answer what the block draws
first or last). `lint/file-rules.test.ts` fails an `isInlineWidget(` or `flattenInlineWidgets(` call
under `components/` or `src/lib/plugins/` outside that file.

**G4.126 · Every package is bundled before a page asks for it.** Vite's dev server pre-bundles the
packages its scan finds from the route files; one it misses is bundled when a page first imports it,
reloading every open page and failing any e2e spec mid-load. `vite.config.js` :: `posixScanEntries`
fixes SvelteKit's backslashed globs on Windows, and a package loaded with `import()` is listed in
`optimizeDeps.include`. `lint/dev-prebundle.test.ts` fails a scan glob matching no route file, or a
bare-package `import()` under `src/lib` or `src/routes` missing from the list.

**G4.127 · A check that skips without a DOM says so.** Most unit test files run in plain Node with no
`document`, so code that asks whether one exists picks what those tests run. A dev check that would
do more with a DOM asks `src/lib/assert.ts` :: `documentForCheck`, which warns `needs-dom` (failing
the unit test, whose fix is the jsdom docblock). Any other DOM branch gets a row in G4.127's table in
`lint/file-rules.test.ts`, keyed by file and function and saying what runs without one; the test
fails when a function's count of DOM tests (`typeof document`, `typeof Element`,
`globalThis.document`, `'document' in globalThis`) moves off its row.

**G4.128 · Every kind is asked about its empty state.** The `placeholder` hint is decided in
`components/blocks/placeholder-hint.svelte.ts`, which every `createEditableSurface` block reads
through the attributes its element spreads. `test/components/placeholder-every-kind.svelte.test.ts`
mounts every registered kind, bundled plugins included: each shows the hint in an empty fixture or
carries a reason it's never asked.

**G4.130 · One span for every write over a code block range.** Where the mode shows a code block's
fence lines, an edit over a range rewrites the range; where it hides them, only the range's part
inside the body, and a range on fence structure alone writes nothing.
`src/lib/components/blocks/code/code-fence-boundary.ts` :: `editSpan` answers that for every route
(delete, type-over, IME, a bracket wrap, cut, paste, a command's removal). Two rows in
`lint/file-rules.test.ts`: `clampRangeToBody(` is called only there and in `code-indent.ts`, and in
the code block's folder `fenceLinesShown` is read only where it's derived, as the whole last argument
of `editSpan`, or as the last condition of an early return.
`test/blocks/code/code-fence-edit-span.test.ts` runs each route in both modes.

**G4.131 · A block syntax's bytes are read and written in its own module.** Two routes that each read
a block's syntax drift apart, so each syntax gets one module, and `lint/file-rules.test.ts` keeps a
row per syntax (`SYNTAX_MODULES`) that fails a copy elsewhere:

- **`$$` math.** `src/lib/plugins/latex/math-shape.ts` (`readMathSource`, `mathCloserLine`,
  `mathBlockLines`); `math-source.ts` :: `sliceMathSource` picks between it and the ` ```math ` fence
  form. The row fails `$$` spellings (strings, regexes, the fence constant, line splits) under
  `src/lib/plugins/latex/` outside that module. `test/plugins/latex/math-shape-parity.test.ts`,
  `math-block-writers.test.ts`.
- **Table rows.** `src/lib/core/parsers/table-line.ts` reads rows (`rowCellSpans`, `opensOnPipe`,
  `wrappedInPipes`, `boundaryPipeAt`) and writes them (`tableRowLine`, `tableDelimiterLine`,
  `newTableLines`, `spliceCells`). The row fails a row's edge pipe or a delimiter cell spelled by hand
  anywhere else in `src/lib/`. `test/core/parsers/table-row-writers.test.ts` pins the bytes, LF and
  CRLF.
- **Table opening.** `src/lib/core/parsers/table.ts` :: `matchTableOpening`, asked by the parser and
  the grid paste; a header's cell count compared with a delimiter's `columnCount` elsewhere fails.

**G4.133 · An e2e mode switch waits for the mode.** A mode the editor never applied leaves it in
source mode, where most live-mode assertions pass anyway. `EditorPage.goto` checks the mode its query
names, `EditorPage.setPresentationMode` waits for the one it sets, and `src/lib/e2e/mode-switch.ts`
holds the clicks (`clickModeToggle`, `clickModeButton`), each waiting on `data-presentation`.
`e2e/lint/e2e-drivers.test.ts` fails a bridge `setPresentationMode` call outside `editor-page.ts`,
and a mode toggle or button mentioned outside `mode-switch.ts` and its two allowed specs.

**G4.141 · One writer for the drawn caret.** `data-caret-drawn` (the attribute that hides the
browser's caret) and `md-drawn-caret` (the bar) are named in `caret/drawn-caret.svelte.ts` alone
(the bar also in `caret/block-content-selector.ts`, so a block-content lookup skips it), so the
attribute and the bar change in one paint and there's one bar per editor.
`lint/drawn-caret-guards.test.ts`.

**G4.142 · `caret-color` on the known surfaces only.** The production CSS and Svelte styles declare
`caret-color` for `[data-caret-drawn]`, the cross-block rule, `.whole-block-input` and the gap
caret's proxy, each with its reason, and nothing else: another rule would hide or recolor the
browser's caret behind the drawn caret's back. `lint/drawn-caret-guards.test.ts`.

**G4.143 · Every caret write asks for a paint.** `caret/widget-offset.ts` writes the native selection
only inside `createCaretWriter`, whose writes and clears call `drawnCaret.request`;
`test/caret/caret-writer-request.test.ts` calls every writer method and counts one request each (its
table typed over the writer's keys). The frame callback in `caret/drawn-caret.svelte.ts` calls
`paint` and nothing else, keeping G4.4's allowlisted frame paint read-only.
`lint/drawn-caret-guards.test.ts`.

**G4.144 · The old widget and gap caret painters and the edge ring stay gone.** Nothing under
`src/lib`, tests included, names the classes the old widget and gap carets painted with
(`md-snap-after`, `md-snap-before`, `md-snap-caret-active`, `gap-caret-line`), the edge ring's names
(`md-edge-held`, its token, `EDGE_HELD_CLASS`, `heldElements`), or a caret blink `@keyframes` other
than `md-caret-blink-a`/`-b`. A second element painting a caret cue is a second caret; draw it as a
state or a look of the drawn caret. `lint/drawn-caret-guards.test.ts`.

**G4.145 · One rule for whether a click follows.** A file that handles a click doesn't test
`ctrlKey || metaKey` (or `!ctrlKey && !metaKey`) itself; it asks `src/lib/activation-click.ts` (through
`EditorPolicies.activationClick`, `EditorContext.isActivationClick` or a widget's
`isActivationClick` prop), which reads the mode and the host's `linkClick` at the click. The
allowlist holds the reads that decline a modified key or press, and the diagram's zoom and
commit shortcuts. `lint/file-rules.test.ts`.

**G4.146 · One answer to "did this press travel".** Nothing measures a release against its own
press record by hand: the editor root's press tracker (`createPressTracker` in
`src/lib/activation-click.ts`, fed in the capture phase) answers for the follow rule, the margin
drag, a widget's press and a rendered block's click. A second record would let one route call a
release a click while another calls it a drag. `lint/file-rules.test.ts`.

**G4.147 · A memory change repaints the caret.** The caret memory's `onChange` (wired to
`drawnCaret.request` in `components/Editor.svelte`) hears every call that changes the side, the
pending marks or a record, and none that changes nothing, since a typed letter sets the side on
every key. `test/caret/caret-memory-repaint.test.ts` reads the methods off the object, so a new one
joins its table of changes or its exemptions (reads, the column, a write's own hold), each with a
reason.

**G4.148 · The look costs a key outside brackets nothing.** A letter typed mid-word with no `[…]` or
`<…>` around it, live and source, in a block of one construct and of two hundred: one look answer
however often the key paints, no trial insertion, parse or screen read, the same nodes visited in
both blocks, and the same paints as before the look. `test/caret/caret-look-cost.svelte.test.ts` on
the `caretLook*` counters; `test/blocks/text/next-byte.test.ts` pins the shortcut's condition from
both sides.

**G4.149 · The preview is the spend, dry.** `caret/next-insertion.ts :: createInsertionRecords` runs
one loop for a write's hold and for the preview the caret's look reads, and a record's `apply`
changes nothing: one that waits on returns `kept`, which the hold runs when the write lets go.
`test/caret/next-insertion.test.ts` applies each record twice and compares every preview with its
spend.

**G4.150 · One placer for a hidden edge.** Which side of a hidden edge a letter takes is decided
in `components/blocks/text/edge-seat.ts :: hiddenEdges` alone, from the caret memory's record, and no
other file reads that record or how the caret arrived. `lint/edge-rule-guards.test.ts`.

**G4.151 · One click-side check.** `components/blocks/text/click-side.ts :: clickSide` (a fresh
start past a line's end, or the side of a code chip's border) is called only from
`widget-interaction.ts :: snapClickToWidgetEdge`, the click entry both prose blocks' `onClick` go
through, and neither `onClick` measures the press against its text itself.
`lint/edge-rule-guards.test.ts`.

**G4.152 · Everything a click follows can be edited.** Following and Edit link read one answer,
`components/blocks/text/link-at-point.ts :: clickFollowsAt`: a construct whose policy row declares
`followEdit` (`followedConstructAt`), or a widget whose kind claims the activation click.
`test/blocks/text/follow-edit-parity.test.ts` renders a sample of every built-in inline kind (its
table typed over the kind union) plus the other link shapes, and every `a[href]` in the result must
resolve to such a construct with an edit target in live mode. `lint/file-rules.test.ts` holds the
route half: following a link (`window.open`, `activateLink`, a `closest('a[href]')` lookup) happens
only in the root click, `components/editor-root/gestures.ts`, which asks `clickFollowsAt` first.

**G4.155 · Every composing-flag holder asks both composition questions.** A holder of a composing
flag (the editable surface, the caret host) asks `editor-actions/dropped-composition.ts` whether the
browser dropped its composition (`reportDroppedComposition`) and whether a composed run opens one
there (`opensComposition`). A range across blocks claims a composition's start, so the block its
removal leaves the caret in, a rule's hidden host included, only ever sees the runs. The guard knows a holder by its call to `reportDroppedComposition`, so a new holder asks that one too.
`lint/composition-holders.test.ts`.

**G4.157 · Every bundled block kind can be inserted.** `test/plugins/insertable-kinds.test.ts`
installs every plugin under `src/lib/plugins/` from its zero-argument factory and reads the kinds
they register: each one is in the tree some insert entry's Markdown parses to (a title row comes
with its container), or is listed with why no entry makes it. A listed kind that's gone or has
gained an entry fails too.

**G4.159 · An emptied container keeps its opening line.** Each container kind (bullet, ordered and
task item, quote, nested pairs of them, footnote definition, alert, admonition) has its last text
deleted at the very end of the document, through the text write and through the ancestry rebuild,
and the bytes must reload as the empty container the editor still shows: `- `, `>`, `[^1]: `.
`test/schema/emptied-body-bytes.test.ts`.

**G4.163 · One caller per mark gesture.** A call into a mark's `interactive.onClick`, `onHover` or
`onActivate` sits only in `decorations/mark-hover.ts` (the hover lifecycle, keyed by the decoration),
`decorations/mark-activation.ts` (the activate command) and `components/overlays/DecorationOverlay.svelte`
(the click), each inside the engine's `runMarkHandler`. A new route that called a handler itself
would skip the one-end rule or the `error` event. `test/invariants/lint/file-rules.test.ts`.

**G4.165 · Text that moves inside an unresized block is reported.** A mark or selection overlay is
measured against the text under it, and a resize observer can't see that text slide sideways
inside a box that keeps its size. Showing or hiding markers is the usual cause. Every write of the
marker hooks (`data-focused` on a host, the reveal class on a marker span, the mode and theme
attributes on the root) reports it to `components/overlays/text-moves.ts :: createTextMoves`, and
so does an inline widget swapping to its source and back, and focus entering or leaving a block
that holds only markers (a `:focus-within` rule shows them). The overlays over that text then
measure again a tick later. Image and font loads report there too. `lint/file-rules.test.ts`
fails a file that writes one of those hooks without being on its list, each entry saying how it
reports. The scan reads DOM writes, so the widget swap and the bare-marker focus are held by their
rows in `e2e/tests/decorations/mark-overlay-follows-text.spec.ts` instead.

**G4.166 · The drawn caret stays on the device grid.** The paint puts the bar's edges on whole
device pixels (`caret/drawn-caret-target.ts`) and hands the stylesheet the device pixel ratio, so
each width rounds to the nearest whole device pixel, like the browser's caret, and each offset down
to one. A shape whose length skips that rounding blurs across two pixel columns at a fractional
display scale. `lint/drawn-caret-guards.test.ts` fails a length set in a `.md-drawn-caret` rule
with no twin in `editor.css`'s device-rounding block, and a width there not rounded to the nearest.

**G4.170 · The header is the first row.** A table's rebuild makes row 0 its header and every other
row a body row, so an insert, move, delete or split never leaves the flag on the row that used to
be first. `lint/table-header-flag.test.ts` fails a file other than the table parser and
`schema/container-rebuilders.ts` that writes the flag.

**G4.174 · Both builds for every entry point.** Each JavaScript entry in package.json `exports`
names its source build under `svelte` and the prebuilt one under `default`, at the same path below
`dist/prebuilt/`; `scripts/lib-alias.mjs :: publishedEntryPoints` throws on any entry that breaks the
pairing, so the prebuilt build's own entry list, the source scans and verify-pack all stop together.
`sideEffects` covers the whole prebuilt, since a host bundler that drops a chunk it thinks is pure
loses the registrations inside it. `lint/plugin-pack-parity.test.ts`; `scripts/verify-prebuilt.mjs`
then checks the built output: it imports nothing but its listed externals, every entry loads in Node,
a kind registered through its `/plugin` parses through its root, and it stays within its size budget.

**G4.175 · Runes mode only.** A component with no rune compiles in legacy mode, which turns on the
legacy flag in the Svelte runtime of the app compiling it. The prebuilt build forces runes mode
itself, so this guards Svelte hosts: every `.svelte` file under `src/lib` uses a rune or says
`<svelte:options runes />`. `lint/file-rules.test.ts`.

**G4.178 · A plugin view that throws costs only itself.** A file under `src/lib` that mounts a
Svelte component a plugin handed it (a `mount`, or a component picked at render time) also calls
`warnIfForeignRuntime`, the sign it catches the throw, paints its fallback and reports on `error`
(G1.90). Two files are exempt: the editor's own mount in `create-editor.ts`, and `svelteView` in
`svelte-view.svelte.ts`, whose views only `mountPluginView` calls. `lint/file-rules.test.ts`;
`plugins/view/mount-plugin-view.test.ts` holds a Svelte view that throws while unmounting to the
same report.

**G4.180 · Corner controls clear the find bar.** A hover control pinned to a block's top-right
corner (absolute, placed by `top` and `right` or by `inset`, hidden at rest by opacity or visibility)
carries `data-corner-control`, so the open find bar moves it below itself when it covers it.
`lint/corner-control-marker.test.ts`.

**G4.181 · Wrappers release in lockstep.** Each package under `packages/` (the framework wrappers)
has the root's version and peers `@voithos-labs/aragonite` at exactly that version, so an app can
only ever install one core next to them. `scripts/check-lockstep.mjs` holds the rule;
`npm run release:publish` runs it before publishing every package together, and
`lint/lockstep-versions.test.ts` runs it on the tree.

**G4.183 · No Svelte in a non-Svelte app.** The prebuilt build carries its own Svelte, so the core
declares `svelte` an optional peer. `scripts/adapter-smoke.mjs` installs the packed tarballs into
each framework example and fails if `node_modules/svelte` shows up there.

**G4.184 · The editor brings its reset.** `editor.css` opens with a margin, padding and box-sizing
reset scoped to what the editor renders, so a host page with no reset lays it out the same. Every e2e
route but `/test/no-reset` loads `src/app.css`, whose global reset would hide a declaration only it
carries, so the scan holds the editor's reset to every declaration of that one. DOM a host builds sits
under a `data-host-content` element and keeps the page's styles. `lint/editor-reset-parity.test.ts`;
`e2e/tests/host-reset.spec.ts` checks both halves on `/test/no-reset`.

**G4.185 · Published types name no Svelte outside `/svelte`.** A React or Vue app type-checks the
package's declarations with no Svelte installed, so only `@voithos-labs/aragonite/svelte` may reach a
`svelte` import, and no entry may reach a stylesheet import (`scripts/prune-dist.mjs` strips them from
the emitted `.d.ts`). `scripts/verify-types.mjs`, run by verify-pack, walks each entry's declarations
through their relative imports and names the chain to any it finds; it also fails when `/svelte`
reaches no `svelte` at all, which would mean the walk sees nothing. `lint/published-types.test.ts`
holds the walk to every import shape over a small declaration tree.

**G4.186 · One wrapper draws every plugin view.** No file calls a plugin's `view` or `row` field
itself: it hands the view to `plugin-view.ts :: mountPluginView`, the one place that contains a
throw, reports it once and destroys the view once (G1.96). `lint/file-rules.test.ts` fails a call on
either field, or on a local named `view` or `row`, anywhere under `src/lib`; a local under any other
name gets past it.

**G4.187 · Every framework app is tested.** `examples/adapter-suite/apps.mjs` lists the suite's
projects, and `scripts/adapter-smoke.mjs` builds and installs whatever it lists. An app under
`examples/` with no entry there is never installed from the tarballs or tested, and a spec no
project names never runs. `lint/adapter-apps.test.ts` fails on either.

**G4.188 · Wrappers import on a server.** A server render imports a wrapper before any browser
exists, so each JS entry a wrapper's `exports` names must load in plain Node without touching the
DOM or reading a value declared further down the file. `scripts/node-import.mjs ::
nodeImportFailures` imports each one in a child Node process, and `scripts/verify-pack.mjs` runs it
on every wrapper after the build. `lint/wrapper-node-import.test.ts` feeds it a clean entry and two
broken ones.

**G4.189 · Host colors come from one place.** `editor.css` resolves each host color on the
editor root (the page's value, or the built-in palette in the editor's mode) and hands the result to
the root's children under the host's own name. So a read inside the editor carries no fallback,
since a literal there would hold one mode whatever `theme` says, and a rule on the root itself (or
its scrollbar) reads the resolved `--md-color-*` name, since the root sees the page's value
unresolved. The rules sit in `editor.css` rather than the theme file, so a theme stylesheet
replaced wholesale keeps them. `lint/host-color-reads.test.ts` covers the library, the bundled
plugins and the reference plugins; route pages are the host and read their own tokens however they
like.

**G4.194 · A block's clipboard comes from its surface.** A block gets its copy, cut and paste
handlers from `editable-surface.ts :: clipboard`, which fills in the editor's half (the reading-mode
check, the caret memory, the image hook, the copy and cut of a range across blocks), and pastes into
its own text through `pasteInline`, which puts the caret where the paste left it. A block that built its own handlers
or called `pasteDispatch` itself would carry a copy of both, and copies drift.
`lint/file-rules.test.ts` fails a `createClipboardHandlers` or `pasteDispatch` call anywhere but the
surface, `surface-clipboard.ts` and the cross-block range replace.

**G4.195 · One place makes a command its own undo step.** A command isn't typing, so one Ctrl+Z
should undo the command and nothing around it. A paragraph and a table cell both run their commands
through `components/blocks/text/inline-commands.ts :: perform`, which waits for a shown source to
close and then isolates the write. `lint/file-rules.test.ts` fails an `isolateUndoEntry` call
anywhere else but the code block's language field.

**G4.197 · Built-ins register on the first grammar read.** The block parser's modules import each
other in a loop, so a built-in registered at a module's top level runs before its own module has
finished loading, and a host that imports that module first gets a crash or a grammar with no
built-ins. So nothing on the loop registers a built-in kind at load: `schema/block-openers.ts`
registers them inside the first read of the grammar. `registerBuiltInDescriptors` runs under
`registerAsCore`, so the built-ins belong to no plugin whichever caller gets there first (a plugin's
setup included) and survive the test reset.
`test/core/built-in-load-order.test.ts` resets the module graph, imports each module on the loop
first, and parses one block of every built-in kind; putting a registration back at the top level of
`core/parser.ts` turns it red with the load-order `ReferenceError`.

**G4.200 · One read of a block's hidden screen.** The rules for a construct's hidden edge only
apply where the block hides markers at the caret, and they need the screen it hides them on.
`caret/widget-offset.ts :: hidingScreenOf` answers both at once. `lint/edge-rule-guards.test.ts`
fails any other file that calls `screenVisibilityOf`, except the dev check that compares it with
the stylesheet.

**G4.201 · One painter tints a selected widget.** A widget selected whole, or one a browser range runs
across, wears the selection tint, so a key never replaces something the user couldn't see was
selected. `selection/widget-selection-paint.ts` decides which widgets wear it for every shape at
once (the image, a live `<br>`, a plugin widget). `lint/file-rules.test.ts` fails the
`md-widget-selected` class written anywhere else.

**G4.207 · Newer CSS stays behind `@supports`.** Safari 15 can't parse `color-mix`, container
queries or container units, and a rule it can't parse loses its whole declaration. Each use sits in
an `@supports` block after a plain fallback, as the selection tints in `editor-theme.css` do.
`lint/safari-floor-css.test.ts` reads every shipped stylesheet and component `<style>` block and
names the `path:line` of any use outside one.

**G4.208 · Who runs the fix-up.** Three rows hold the names to their callers: `settleEdit` and
`settleContentWrite` to `settle.ts`, the commit and `updateNodeContent`; the ops whose fix-up runs a
step of its own (`writeNodeContent`, `deleteNode`, the join and the move) to the mutations that
report that kind through `describeEdit`, since the commit skips a step nobody reported; and
`fixesUpOwnWrites` to the format toggle, the one commit G1.112 skips. A new caller of any of them
is a fix-up doubled or dropped in the making. `lint/separator-write-doors.test.ts`.

**G4.209 · The list item's marker stays in its cell.** A prefix handed to a child block paints only
on text, so an item that opened with a code block, a table or another list once drew no marker and
hid its bytes. `ambientPrefixForFirst` is named only where a plugin container offers its prefix
and where `BlockList` hands it on. `lint/file-rules.test.ts`.

**G4.211 · Every source-showing kind gets the caret rows.**
`e2e/tests/plugins/widget-reveal-caret.spec.ts` types each kind's opening byte in front of a body
that completes it, in source and live mode, and expects the caret one past the byte with the source
shown (G1.115 is the runtime half). The scan lists every file that registers `revealSource: true`
and fails when one has no row there, or, for a kind with a content span (inline math), when the
spec it names is gone.
`e2e/lint/reveal-kinds-covered.test.ts`.

**G4.212 · The shared clipboard helper.** A spec that calls `navigator.clipboard` or presses the
paste chord itself only works where the real clipboard answers the page, which WebKit's doesn't,
so both fail the scan outside `e2e/clipboard-arm.ts`. The helper is where each engine's clipboard
lives: the system clipboard in Chromium, an in-page store the `page` fixture installs in WebKit.
`e2e/lint/e2e-drivers.test.ts`.

**G4.214 · One measure of a caret.** WebKit and Firefox measure a collapsed range right after a `\n`
on the line that `\n` ends, which puts every line start on the line above.
`caret/visual-lines.ts :: caretRectAt` measures the next character instead, and every caret box
goes through it: the column search, the edge-line check, the sticky x, the drawn caret, the scroll
into view, the drop caret and `rects.caretRect()`. The scan fails a Range measured anywhere else
outside a short allowlist of spans that are never collapsed. A caret the writer puts at a line's
start lands in the next line's text for the same reason
(`caret/widget-offset.ts :: findDomTextLanding`). `lint/file-rules.test.ts`.

**G4.215 · The marker column costs what changed.** The column is sized from the marker-width counts
the list node holds, which the parse fills and the list's rebuild keeps (G1.118 holds them to a
recount). In a list of four hundred items, mounting reads no item for the column; each key (the
first, a paused one, one in a burst, a marker typed in place, Enter) reads at most the item it
rewrote beyond the items its rebuild already joined in full; and an undo reads none, since the
entry's list carries its counts, which no later edit changes in place.
`test/blocks/list/marker-column-scans.test.ts` on the
`listMarkerReads` and `joinedChildReads` counters.
