# Feature: needsUndoCheckpoint resets across typing/structural-op boundaries

## Happy paths

- Type 5 chars (batch A), press Enter to split (structural op), type 5 chars in the new block (batch B). Three Ctrl+Z keypresses walk back in order: batch B → split → batch A. Fourth Ctrl+Z does nothing to the original doc.

## Edge cases

- Type, click into a different block, type: two independent batches separated by the focus change, not the structural op.

## Typing either side of a structural edit in the same leaf

- `one\n\ntwo\n`, `X` typed at the end of `one`, Backspace at the start of `two`, `Y` typed, one Ctrl+Z: only `Y` goes, `oneXtwo\n`
- `- a\n- b\n`, `X` typed after `b`, Tab, `Y` typed, one Ctrl+Z: only `Y` goes, `- a\n  - bX\n` (miss-analysis: every type-edit-type spec moved the caret to a new leaf, whose new id ended the batch anyway, or waited out the pause, so removing the commit's own end of the batch reddened nothing)
- `- a\n  - b\n`, `X` typed after `b`, Shift+Tab, `Y` typed, one Ctrl+Z: only `Y` goes, `- a\n- bX\n`

## A burst that ends in a kind change

- `Plan\n===\n`, caret at the end of the underline, Backspace three times (the third makes it a paragraph), one Ctrl+Z: the source is back to `Plan\n===\n`, caret where the burst started
- The same inside a quote, `> Plan\n> ===\n`: one Ctrl+Z restores it (regression #471: the kind-changing key was its own undo step inside a container; miss-analysis: the batch tests typed same-kind bursts and the kind-change tests typed one key at the top level, so no test ended a burst with a kind change below the root)
- The same inside a list item with a second item below, `- Plan\n  ---\n- b\n`: the emptied underline line stays in the first item (`- Plan\n  \n- b\n`), a reload reads the same one list of two items, and one Ctrl+Z restores it (regression #618: the item's rebuild wrote that line with no indent, which ended the item and split the list in two; miss-analysis: the rebuild tests only fed it trees straight from the parser, and the parser never hands back a paragraph whose own bytes end in a blank line)
- `- a\n\n  abcdef`, `>` typed at the start of `abcdef`: one Ctrl+Z restores the text with the caret back at its start, `[0,0,1]` offset 0 (regression #22: the undo put the caret after the typed `>`; miss-analysis: the kind change's own commit recorded the caret as it stood after the key, and no test read the caret an undo restores below the root)

## Regression notes

- Guards the closed "needsUndoCheckpoint drifts wrong" defect class.
