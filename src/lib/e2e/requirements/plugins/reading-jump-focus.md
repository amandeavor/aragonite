# Feature: a reading-mode jump lands focus where Tab continues

Reading mode has no caret, so a jump (a footnote reference to its definition, a definition's
marker back to its reference, a table of contents entry to its heading) lands focus, not a caret.
Focus goes to the inline widget that ends at the jump's landing point when there is one with a
tab stop, else to the target block's own element, and the browser keeps no selection. Every
engine then starts Tab and Shift+Tab from that element: Tab reaches the first tab stop after it,
Shift+Tab the one before it.

The document has `[[toc]]`, a paragraph citing `[^b]` then `[^a]` with a link before both, a
table cell citing `[^c]`, filler, a far heading, then the definitions, so each jump mounts its
target. Each scenario below runs once with Tab and once with Shift+Tab, on all three engines.

## Happy paths

- **Reference to definition** (Enter on the focused reference, or a click): focus is on the
  definition's body block; Tab reaches its `[^a]` marker, named `Back to reference a`; Shift+Tab
  reaches the block before the definition
- **Marker back to its reference** (Enter after Tab reaches the marker, or a click): focus is on
  the `[^a]` reference itself, not the paragraph, so the link and `[^b]` before it are not in
  the way; Tab reaches the next block, Shift+Tab reaches `[^b]`
- **Table of contents entry to its heading** (a click, or Enter on the focused entry): focus is
  on the heading's block; Tab reaches the next block, Shift+Tab the one before

## Edge cases

- **Marker back to a reference in a table cell:** focus is on the `[^c]` reference in the cell,
  through the cell's own focus; Shift+Tab reaches the cell
  (the Tab half is `fixme` on #759: reading mode runs Tab in a table cell as cell navigation, and the
  last cell keeps it)
- **A host's `navigateTo` into a table cell's text** (once, no Tab): focus is on the cell, and
  `getSelection()` is null there too, not the cell's start
  (miss-analysis: every jump row landed on a widget or a prose block, so the table's own caret
  report, which named the focused cell's start with no caret in it, had nothing to fail)

## User interactions

- **Leaving reading mode after a jump** (reference to definition, and the marker back to its
  reference), once from a host's own button that takes focus out of the editor and once from a
  shortcut that leaves focus where it was: the caret goes where the jump put focus, so a typed
  letter lands at the definition's start, or right after the reference
  (miss-analysis: no row typed after leaving reading mode, so a switch out that put the caret
  back where it was before reading, offscreen, or nowhere at all, read as fine)

## Error cases

- Every scenario asserts the browser holds no selection in the editor and `getSelection()` is
  null after the jump, and that the editor's error channel stayed empty

## Miss-analysis

- Every jump spec asserted where the block landed, never where Tab went from there, and the one
  that did ran the forward hop alone with Firefox marked `fixme`, so no row compared the engines
  across every jump route.
