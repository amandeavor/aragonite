# Keyboard navigation: the caret's line at a soft wrap

Where a line wraps, one spot in the text is both the end of one visual line and the start of the
next, and the browser remembers which one the caret is showing. Measuring the spot gives the same
answer either way, so the editor asks the browser instead whenever the answer decides something: an
arrow leaving the block, Home on a list item's first line, a soft-line delete. Every row fixes the
editor's width, so the paragraph wraps the same way on every engine, and runs on Chromium, Firefox
and WebKit.

## What the browser does with the question

- End on a line, then asking where the line ends: the caret doesn't move, and the next ArrowDown
  goes where it would have gone without the question
- Home on the next line, then asking where the line ends and going back to its start: the caret is
  back on the same line's start (Shift+Home after it selects nothing), and ArrowDown goes where it
  would have gone without the question
- the same in a list item, and with an image starting the next line
- End on a short line 1 of a two-line paragraph, ArrowDown: the caret lands on line 2 at line 1's
  column, inside the block, so the question left the caret on line 1's end
- after an arrow at a wrap that asks the question, no selection toolbar shows, the selection is
  collapsed, no undo step is added, and one caret shows, on the line the browser shows it

## Happy paths

In a paragraph between two one-line blocks, and in a list item between them:

- click at the start of line 2, ArrowUp: the caret moves to line 1, inside the block
- Home on line 2, ArrowUp: the caret moves to line 1, inside the block
- End on the second-to-last line, ArrowDown: the caret moves to the last line, inside the block
- Home on the last line, ArrowDown: the caret leaves for the block after, near its start, since it
  left from the start of a line
- End on line 1, ArrowUp: the caret leaves for the block before, past its middle, since it left
  from the end of a line

## With Shift

- Home on line 2, Shift+ArrowUp: the selection runs from line 2's start up onto line 1, inside the
  block
- End on the second-to-last line, Shift+ArrowDown: the selection runs onto the last line, inside the
  block
- a range already held from the middle of line 2 back to its start, Shift+ArrowUp: the anchor stays
  put and the focus moves up onto line 1
- a range already held from the middle of the second-to-last line to its end, Shift+ArrowDown: the
  anchor stays put and the focus moves onto the last line
- the first two in a wrapped table cell, where the first Shift+arrow at the cell's top or bottom
  line would take a whole row instead: the selection stays inside the cell

Known gap: the two held-range rows in a wrapped cell still take a row (a `test.fixme` each). A held
range's focus is measured, not asked, since moving it to the line's end and back moves a focus that
ends its line onto the next line on Chromium; the measure reads the wrong line there.

## A soft-line delete

The Mac's Cmd line delete, sent the way `collapsed-delete-class.spec.ts` sends it:

- Home on line 2, Cmd+Backspace: line 1 stays whole and one character goes, the space before line 2
- Home on line 2, Cmd+Delete: line 2's run goes, line 1 stays whole

## Not in this file

- a plain ArrowUp or ArrowDown in a table cell moves to the next cell whatever line the caret is on,
  so a cell's plain rows say nothing about the wrap (`blocks/table/navigation.md`)

## Miss-analysis

- Every vertical-motion row started from a caret the harness placed or from a line with no wrap,
  so no row ever stood on the one spot where a measured caret and the browser's disagree.
