# Feature: reading mode's keyboard is the page's

In reading mode Tab and Shift+Tab are the page's focus walk. The editor keeps one tab stop, the
block whose own element last took focus (a click, a jump, a host's `focus()`), or the first block
mounted before any; every other block is out of the tab order. So a walk visits the editor's
controls only (links, footnote references and back markers, outline entries, the code copy
button, a plugin's buttons) and the one stop, then leaves the editor.

The document holds one of each leaf kind: a paragraph with a link, a heading, a paragraph, a list,
a blockquote, a code block, a table, a divider, a details block, an admonition, a mermaid
diagram, a paragraph citing a footnote, a paragraph with a link, and the footnote's definition.
Host buttons sit before and after the editor. A walk's expected list is read off the page: every
control after the focused element (before it, for Shift+Tab) in document order, with plain links
left out on an engine whose walk skips them (a bare `<a href>` probe on that engine says which;
WebKit skips them unless the user's own setting includes them).

## Happy paths

- **Each leaf kind, clicked, then Tab out** (paragraph, heading, list item, blockquote line, code
  block, first and last table cell, divider, details summary, admonition title, mermaid
  diagram, footnote definition): the clicked block is the editor's only tab stop that isn't a
  control, and the walk visits exactly the controls after it, then reaches the host's button
- **Each leaf kind, clicked, then Shift+Tab out:** the same, backwards, ending on the button
  before the editor
- **Before any click:** the first block is the only tab stop that isn't a control

## Edge cases

- **A drag across two blocks:** the editor's range spans both blocks, and Tab then walks the
  controls after the focused block and leaves (#759's sibling: the range's Tab took the key)
- **Scrolled far from the stop by the wheel, then Tab in from a host button:** focus lands on a
  mounted block on screen, not one windowed out
- **In source mode** every block keeps its own tab stop, since the editor's keys own Tab there:
  Tab from a host button lands on the first block, wherever the caret was

## User interactions

- **Tab from a host button after clicking a block:** focus lands on the clicked block
- **Enter on a focused footnote reference:** it still jumps to its definition
- **Enter on a focused link:** it still follows the link

## Error cases

- Every walk asserts the editor's error channel stayed empty
- A walk that never reaches the host button fails, naming every element it visited

## Waiting rows

- On Firefox and WebKit a click on a word leaves the browser's caret there, and they start the
  walk from it: Firefox and WebKit skip a footnote definition's back marker before the clicked
  word, and WebKit's Shift+Tab from the caret finds the block itself and stays. Those rows are
  `fixme` until reading mode clears a click's caret.

## Miss-analysis

- Every table cell Tab row ran in an editing mode, and the one reading-mode row asserted a cell
  move, so a cell's own copy of the keymap's Tab, which took the key after reading mode's
  dispatcher declined it, read as a feature (#759).
- No row pressed Tab over a range in reading mode, so the range's Tab, taken even when nothing
  indents, trapped focus unseen.
- No row counted reading mode's tab stops, so every paragraph being one read as fine.
