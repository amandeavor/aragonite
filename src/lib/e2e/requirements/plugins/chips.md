# Feature: a drawn widget selected whole

`{{name}}` renders as a chip. The harness plugin (`routes/test/plugins/chips`) registers it with
`claimsActivationClick` and no `revealSource`, so it never shows its source: Mod+K beside it selects
it whole, the way the caret selects any drawn widget. Seed `chips`: a chip in a paragraph (block 0)
and one in a table cell (block 1, first body cell).

## User interactions

- Mod+K beside a chip, then Ctrl+C: the clipboard holds the chip's bytes and the document is
  unchanged, in a paragraph and in a table cell.
- Mod+K beside a chip, then Ctrl+X: the chip's bytes leave the document and land on the
  clipboard, in both blocks.
- Mod+K beside a chip, then Ctrl+V: the pasted text takes the chip's place, in both blocks.

## Regressions

- Copy, cut and paste over a chip a table cell had selected did nothing: the event reached the
  editor root, which hands a selected widget's clipboard to its block, and the cell had no
  handler there. Miss-analysis: every selected-widget clipboard test drove a paragraph; no test
  selected a widget in a cell, since no bundled widget a cell draws can be selected.
