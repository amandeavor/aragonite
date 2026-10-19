# Feature: a fast drag ends where it was released

A drag's selection runs from where the press went down to where the pointer let go, whatever
order the engine delivers the last events in. Moves are handled once per frame, so a fast hand can
let go in the same frame as its last move. That move can then arrive after the release,
and the selection toolbar, which shows on release, can be drawn over the release point before the
drag reads what's under it. Each row settles the drag at one point for a frame, then moves to
the release point and lets go in one frame, and checks the selection after the release.

## Every route that ends a pointer selection

- a press in text, released in a table body cell: the range runs from the press to that cell
  - Miss-analysis: every drag spec let go one frame after its last move had been handled; none
    let go in the same frame as a move, which is the only shape where the release point is new
- a press in the editor's margin, released in a body cell: the same range, from the margin drag
- a double-click drag from a word, released in a body cell: the range runs from the word's start
  to that cell
- a press in a cell, released in another cell of the same table: the cell rectangle between them
- a press in a cell, released in the paragraph below the table: the range ends at the release
  point in that paragraph
- a press in text, released in the next paragraph: the range ends at the release point
- a press in text, released past the middle of a divider: the divider joins the range whole
- a press in text, released outside the editor beside a paragraph: the range ends at that
  paragraph's nearest position

## What the user sees

- Ctrl+B after a fast drag from a paragraph into a body cell bolds the paragraph and every row
  through that cell's row, and leaves the rows below it alone; the selection toolbar is showing
  after the release
