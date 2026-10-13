# Feature: Mark overlays follow their text

A mark's overlay is measured against the text under it, so anything that moves that text has to
measure it again, even when the block's box stays the same size. Hiding or showing Markdown
markers is the common way that happens: the text slides sideways inside a box that doesn't
change. Every row loads `**bold** hello world` and marks `hello`, then checks that the overlay's
left and right edges sit within 1px of the painted word after the step. A flip between two
modes that both hide markers (live and reading, say) moves no text, so it gets no row.

Miss-analysis: every overlay test measured once after painting, and the only mode-flip row
(reading mode) checked that the overlay still painted, never where it painted.

## Happy paths

- Flipping from source to live hides the bold's `**`: a plain mark's overlay and a search
  highlight both move left with `hello`
- Flipping from live back to source shows the `**` again: both move right with `hello`
- Flipping from source to reading, and from reading back to source: both follow `hello`
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
