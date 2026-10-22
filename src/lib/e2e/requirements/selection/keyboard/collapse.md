# Feature: Keyboard selection, Collapse

A plain arrow over a selection collapses it before anything can leave the block. Left and Right
collapse it to the end they name and stop there; Up and Down collapse it to its moving end and
then move as a caret there would (`moving-end-line.md`).

## User interactions

- Unshifted ArrowLeft collapses cross-block selection to range start: exits cross-block mode
- Unshifted ArrowRight collapses cross-block selection to range end: exits cross-block mode
- Click collapses cross-block selection: exits cross-block mode

## A range inside one block (source and live)

Each arrow over a range at the edge it names, in the first, middle and last of three equal
paragraphs, then `Q`:

- ArrowLeft over a range at a block's start: `Q` lands at that start, never at the end of the
  block above, and in the first block it never replaces the range
  - Miss-analysis: every arrow-boundary spec started from a collapsed caret, and the only collapse
    specs held a range across blocks, so the boundary checks reading a range's start as the caret
    went untested
- ArrowUp over a forward range in the first block: `Q` lands at the range's moving end instead of
  replacing the range; in the middle and last blocks it lands in the block above at that end's
  column
- ArrowDown over a backward range: `Q` lands in the block below at the moving end's column
- ArrowRight over a range ending at a block's end: `Q` at that end
- ArrowLeft over a range starting mid-block: `Q` at its start
- Controls, green before the fix too: every ArrowRight row, every Up and Down row but ArrowUp in
  the first block (ArrowDown in the last block puts `Q` in the paragraph it appends), the mid-block
  row, the code block rows and the decoded entity row
- Up and Down over a range inside a code block collapse to the moving end, then move one line from
  there, at that end's column, in every engine
- ArrowLeft over a range at the start of a list item, a table cell and a heading keeps `Q` in that
  block (in live mode, after the heading's hidden `## `)
- ArrowLeft over a range right after a decoded entity (live) stops at the range start instead of
  crossing the entity
