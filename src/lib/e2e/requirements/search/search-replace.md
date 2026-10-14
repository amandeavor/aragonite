# Feature: Replace, text, structural, and table rewrites

Rewriting matched text: single Replace and Replace All (one undo step), regex
capture and structural replacements that change block kind or split a block, and
replacement inside table cells.

## Happy paths

- Replace rewrites the active match, advances, and leaves the rest intact.
- Replace All rewrites every match in one pass.

## Edge cases

- A regex `$1` capture reference expands in the replacement.
- Replace All is a single undo: one Ctrl+Z restores the entire original document.

## User interactions

- Find counts matches inside table cells; the matching cells highlight.
- Replace All fixes the text inside every matching table cell.
- Single Replace on a table-cell match rewrites only that cell.
- Replace or All pressed from the keyboard that leaves no match moves focus to the replace field,
  since both buttons disable with no match left. Miss-analysis: the replace tests click with the
  mouse and never check focus afterwards, so a button that disabled under focus stranded it.

## Pinned below the browser

A replacement that introduces a heading marker changes the block's kind, and a regex-mode replacement
with a `\n` escape splits the matched block in two (the single-line replace input cannot carry a real
newline). `test/editor-actions/search-replace.test.ts` and `test/search/replace.test.ts` pin both.
