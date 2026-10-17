# Feature: inline-widget source reveal inside a table cell

A cell uses the same `createWidgetInteraction` and caret-edge dispatch
the prose block uses, so an inline math widget in a cell reveals its `$…$` source
for editing, writes each key as it lands, and draws the widget again on Enter, on focus
leaving or on Escape. One thing is specific to cells: a `|` typed into a revealed formula takes
the cell's typing path, which escapes it, so it can never split the row on reparse. Scenarios run on `/test/plugins?seed=mathtable`
(`| Formula | Note |\n| --- | --- |\n| $x^2$ | ok |\n\nAfter\n`).

## Happy paths

- clicking the rendered math in a cell reveals its `$…$` source without touching
  the CST (the widget vanishes, the raw becomes editable text)
- editing the revealed source and pressing Enter re-renders KaTeX and persists the
  edit; the table stays a two-column row and the source round-trips
- caret-edge entry into the math (Backspace at the cell's trailing edge) reveals the
  source in place rather than deleting the widget

## User interactions

- typing a `|` then a letter into a revealed formula escapes the pipe to `\|` and puts the letter
  after it, so the row keeps its column count; `getSource()` round-trips byte-for-byte
- a burst typed into a revealed source is one undo entry, so a single Ctrl+Z reverts the
  whole edit
- Escape closes the source and keeps the edit
