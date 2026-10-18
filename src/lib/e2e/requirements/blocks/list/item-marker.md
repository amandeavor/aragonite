# Feature: the list item's own marker

A list item draws its marker (`-`, `1.`, a to-do's box) in a cell of its own, beside the item's content, whatever block the item opens with. The marker is built from the item's bytes, so source mode shows every one of them. The item's text, and every later block of the item, starts at the cell's right edge. A press on the marker puts the caret at the start of the item's text.

## Happy paths

- An item that opens with a code block, a quote, a table or a nested list: its marker paints beside that block's first line (the drawn `•`, a number, or the bytes in source), in source, live and reading modes
- The same items in source mode: the marker shows its bytes (`- `, `1. `), visible and only dimmed; `- - nested` shows both markers
- An item with a second paragraph and a code block after its first line: both start at the column where the first paragraph's text starts, in source, live and reading modes

## Edge cases

- An empty bullet, ordered or to-do item (`- `, `1. `, `- [ ] `): the marker sits on the item's empty line, within a quarter line of its centre, in source, live and reading modes
- An empty item, in reading mode: a press on its marker writes nothing
- Composing with an IME at the start of an empty bullet or to-do item: the composed text lands after the marker, once, in source and live modes (Chromium only: the IME driver speaks CDP)

## User interactions

- Press the marker of an empty bullet, ordered or to-do item, then type: the letter lands in the item, in source and live modes; in live mode the press on a to-do's drawn box also checks it
  - Miss-analysis: every caret row clicked the item's text or its source-mode bytes, and none pressed the drawn bullet, where a press in live mode put the caret nowhere and dropped the typing.
- Press the marker of `- alpha`, `1. alpha` or `10. alpha`, then type: the letter lands before `alpha`, in source and live modes
- Press the marker of an item that opens with a table, level with its header row or a body row, then type: the letter lands before that row's first cell text (`| Xa |`, `| X1 |`), in source and live modes
  - Miss-analysis: the table rows only asked which cell a press beside the table picks, and the cells were empty, so a landing pinned to every cell's end read as right.
- Press a to-do's drawn box in live or preview-block mode, then type: the box checks, and the letter lands at the start of the to-do's text
- Select all inside an item's text: the selection holds the text, not the marker, and typing replaces only the text
- Type `- ` at the start of an empty paragraph, then a letter: the paragraph becomes an item and the letter lands in it
- In preview-block mode, focus an item's text: its marker shows its bytes, dimmed, with no drawn bullet, while an unfocused item keeps its bullet

## Miss-analysis

- Only a text block drew the item's marker, inside its own editable line, so an item opening with any other block drew none and hid its bytes in source mode. The marker suites asserted the marker's place inside that line, which pinned the defect instead of the item's look.
