# Group 3: compile time

The words this catalog leans on, and what the enforcement levels mean, are in [the index](../invariants.md).

The strongest level: the violation doesn't compile. Enforced by `npm run check`. Each entry says
what the type retired.

| ID    | What no longer compiles                                                              | Codes |
| ----- | ------------------------------------------------------------------------------------ | ----- |
| G3.1  | An untyped metadata access (`as` cast) on a block node                               | T     |
| G3.2  | A component publishing anything but the three allowed export shapes                  | T     |
| G3.3  | A cell selection point where a character point belongs, or the reverse               | T     |
| G3.4  | A magic number standing in for "end of block"                                        | T     |
| G3.5  | A container without a declared contract                                              | T     |
| G3.6  | A container registration missing its rebuild, or a leaf claiming container fields    | T     |
| G3.7  | Arithmetic across two different coordinate spaces                                    | T     |
| G3.8  | A reader writing a node's serialized bytes                                           | T     |
| G3.9  | Forgetting one part of what the caret means without the others                       | T     |
| G3.10 | A registration pairing fields that can't mean anything together                      | T     |
| G3.11 | An editor option with no word on whether it can change after mount, or is a boolean  | T     |
| G3.12 | A React wrapper prop that isn't an editor option, or hides one                       | T     |
| G3.13 | A Vue wrapper prop that isn't an editor option, or a boolean Vue would read as false | T     |
| G3.14 | A Svelte view whose component wants a prop its slot never passes                     | T     |
| G3.15 | A block kind registered without the view that draws it                               | T     |

### The entries

**G3.1 · Typed per-kind metadata.** `BlockMetadataByKind` plus `metadataOf<K>`. Retired: `as`
metadata casts.

**G3.2 · Allowed component exports.** `svelteBlockView`, whose exports parameter is the
three allowed publication shapes (`BlockComponentExports`): a hand-built leaf's own members, a
factory-built leaf's single `blockApi`, or a container's single `containerApi`. Retired: `as unknown
as` casts, and a component that publishes nothing at all. A factory-built leaf that copies its
members out flat still compiles, since the copy is a hand-built leaf's shape; G4.73 holds that.

**G3.3 · Discriminated selection points.** `SelectionPoint` is a discriminated union
(`CharSelectionPoint | CellSelectionPoint`) on `cellCoordinate`: a cell point needs the literal
`true`, and a char-typed slot rejects a cell point. Retired: the optional-boolean flag's
construction and assignment ambiguity. `offset` keeps its name, so a wrong-space READ narrows to the
`charOffsetOf`/`cellIndexOf` runtime backstop rather than to the compiler.

**G3.4 · Branded end markers.** Branded `CURSOR_END` and `SELECTION_END`. Retired: the `999999`
magic number.

**G3.5 · Declared container contracts.** `containerContract: 'strip' | 'grid' | 'opaque'`. Retired:
the implicit table exemption.

**G3.6 · The container registration group.** `BlockKindRegistration`'s `container` group:
container-only fields register as one unit with `contract` and `rebuildRaw` required and
`isContainer` derived; a leaf augment carrying a `container` group throws. Retired: G1.3, the
runtime pairing guard.

**G3.7 · Branded coordinate spaces.** `caret/coordinate-spaces.ts`: `RawOffset`, `DomTextOffset`,
`EditorX`, `ViewportX`, `CellIndex`, `DocPath`, each created only at its home module with named
conversions per direction. Public entries keep `number` and brand once at the boundary. Cross-space
arithmetic is a type error. Retired: offset-space mixing; `charOffsetOf`'s read-space check narrows
to the runtime backstop.

**G3.8 · Bytes-readonly node views.** `core/node-views.ts :: NodeView` and `DocumentView`:
serialized bytes deep-readonly, the `childIds`/`childSpans`/`markerWidths`/`ownerEpoch` bookkeeping writable. This
is G1.9 as a type: readers hold views, constructors and writers keep `CstNode`, and copying the path
(`tree-operations/unshare.ts`) is the only way back to mutable (G4.13 scans for the casts). Retired:
reader-side byte writes.

**G3.9 · One caret memory.** `src/lib/caret/caret-memory.ts` :: `createCaretMemory` holds the
sticky column, the edge record and the pending marks. A keydown updates them through `noteKey`,
and every other caret move (a click, a paste, an undo, a swap, a blur, a mode switch, a restore)
calls `forget`, which drops all three. There's no method that forgets one alone, so clearing the
column and leaving the side behind doesn't compile. Retired: G4.31's reset half and G2.10's
capture-without-reset pairing.

**G3.10 · Coherent registration pairs.** `BlockKindRegistration` is a block focused as one unit
(`blockFocus: 'whole-block'`, so `supportsInline: false`, no `contentStart` and no title row), or a
block the caret enters: a leaf, or a container, which never declares inline content since its
children hold its text. A content range and its Backspace behavior register together as
`contentStart`, and a container with a title row declares only its middle-child unwrap strategy. A
kind whose container writes its syntax (`contextDependentKind: true`) takes no `opener`, since the
container skips the reparse that opener would serve. `augmentBlockKind` takes none of these fields.

A cast or a plain JavaScript plugin never meets the types, so both calls throw at runtime too:
`registerBlockKind` checks each pair against
`src/lib/schema/registration-pairs.ts :: INCOHERENT_REGISTRATION_PAIRS`, and `augmentBlockKind`
refuses every field on `src/lib/schema/block-kind-descriptor.ts :: FIXED_AT_REGISTRATION`.
`src/lib/test/schema/descriptor-groups.types.test.ts` holds one `@ts-expect-error` per pair, and
`src/lib/test/schema/registration-pairs.test.ts` fails when a table row and its pin don't match.
Retired: G1.32 and G1.37 as dev-time checks, and G1.18's not-a-container branch.

**G3.11 · Every option has a spec.** `editor-props.ts :: EDITOR_OPTION_SPECS` gives each editor
option, `header` included, a timing (`live`: a new value takes effect; `once`: read at mount, later
values ignored) and marks the ones typed `boolean`. It's typed against `EditorOptions` plus
`header`, so a missing row, a row for no option, a boolean without its mark or a mark on anything
else doesn't compile. `create-editor.ts :: createEditor` reads it to skip the `once` keys on
`update`, the Vue wrapper declares its props from it (G3.13), and the consumer guide's Props section
lists the same split. `src/lib/test/editor-root/create-editor.test.ts :: compileTimePins` holds the
`@ts-expect-error`s. One gap stays open: `Editor.svelte`'s `$props()` destructure is a hand list
(Svelte takes only a literal pattern there), so a key missing from it, or read at odds with its
row's timing, still compiles.

**G3.12 · The React props are the editor's options.** `AragoniteProps` in `packages/react` is
`CreateEditorOptions` with `source` swapped for `value`, plus the props only React has (`value`,
`defaultValue`, `onChange`, `className`, `style`). A type pin at the bottom of
`packages/react/src/aragonite.tsx` fails to compile when any other prop appears, or when an editor
option takes one of those React names, and the wrapper forwards every prop outside that list to
`update`. The wrapper compiles in `npm run package`, so that's the gate here, not `npm run check`.

**G3.13 · The Vue props are the editor's options.** Vue needs every prop named at runtime, so
`packages/vue/src/aragonite.ts` declares them from `EDITOR_OPTION_SPECS` (every option but `source`
and `header`, which arrive as `modelValue` and a slot), with `default: undefined` on each option the
table marks boolean, since Vue reads an absent `Boolean` prop as `false` and would override the
editor's default. A type pin fails to compile when the declared keys and `AragoniteProps` differ,
and a second when an editor option takes a Vue-only name or `class`, `style`, `key` or `ref`.
`npm run package` compiles it. Which declaration a boolean gets is decided at runtime, so the
adapter suite's `vue.spec.ts` holds it: an absent boolean keeps the editor's default, and a bare
attribute reads as `true`.

**G3.14 · A Svelte view fits its slot.** `svelte-view.svelte.ts :: svelteView` takes its props type
from the component, so `view: svelteView(C)` compiles in any slot whose props cover what `C`
declares and fails where `C` asks for one the slot never passes.
`src/lib/test/plugins/view/svelte-view.types.test.ts` holds the `@ts-expect-error`s.

**G3.15 · A kind comes with its view.** `BlockKindRegistration` requires `view`, so a plugin kind
can't be registered without what draws it, and the viewless route,
`src/lib/schema/block-kind-descriptor.ts :: registerBuiltinBlockKind`, takes only a built-in
`BlockKind`. Built-ins get their views from the component layer through `attachBuiltinViews`, whose
argument is typed as a complete table of every kind BlockHost can mount (`StandaloneBuiltinKind`),
so a built-in left out of `components/built-in-blocks.ts` doesn't compile. A cast or a plain
JavaScript plugin gets past the types, so `registerBlockKind` also refuses a missing or unbranded
view at runtime, and `augmentBlockKind` refuses a `view` (it's on `FIXED_AT_REGISTRATION`). Pins in
`src/lib/test/schema/descriptor-groups.types.test.ts`; runtime rows in
`src/lib/test/schema/kind-view-registration.test.ts` and `augment-guard.test.ts`. Retired: G1.2's
and G1.18's component halves.
