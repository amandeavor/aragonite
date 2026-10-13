# Feature: Mark overlays follow their text

A mark's overlay is measured against the text under it, so anything that moves that text has to
measure it again, even when the block's box stays the same size. Hiding or showing Markdown
markers is the common way that happens: the text slides sideways inside a box that doesn't
change. An inline widget swapping to its source is another. Most rows load `**bold** hello world`
and mark `hello`, then check that the overlay's left and right edges sit within 1px of the
painted word after the step. A flip between live and reading moves no text, so it gets no row.

Miss-analysis: every overlay test measured once after painting, and the only mode-flip row
(reading mode) checked that the overlay still painted, never where it painted. The widget and
bare-marker rows came later: the first census listed the marker attributes and classes, and
missed a widget swapping its DOM and a `:focus-within` rule, which no attribute write announces.

## Happy paths

- Flipping from source to live hides the bold's `**`: a plain mark's overlay and a search
  highlight both move left with `hello`
- Flipping from live back to source shows the `**` again: both move right with `hello`
- Flipping from source to reading, and from reading back to source: both follow `hello`. A mark
  still paints in reading mode, since decorations are view-only and an inert block with no caret
  doesn't suppress them
- Flipping from source to preview-block, and from source to preview-inline: both follow
  `hello`

## User interactions

- In preview-inline, clicking at the end of the line and pressing Home walks the caret into the
  bold, which shows its markers and pushes `hello` right: the overlay moves with it. Pressing
  End walks back out, the markers hide, and the overlay moves back
- In preview-block, clicking into the block shows all its markers and the overlay follows
  `hello` right. Clicking into another block hides them and the overlay follows it back
- A theme toggle whose host styles widen the bold pushes `hello` right without changing the
  line's height: the overlay follows
- A click at the start of `hello` and Shift+Down twice selects across into the next block; after
  a flip from source to live, the start block's selection paint still begins at `hello`
- In live mode, a block of bare markers (`[]()`) with a mark over them paints nothing while the
  markers hide. Clicking into it shows them, and the mark paints over exactly them; clicking
  into another block hides them again and the mark paints nothing
- With the latex plugin, `Before $x^2$ after hello` with `hello` marked: clicking the formula
  shows its source, which is wider, and the overlay moves right with `hello`
- Leaving the shown source by clicking another block, or by clicking later in the same line,
  renders the formula again, and the overlay moves back with `hello`
