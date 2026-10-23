# Feature: vertical arrow travel past an object block

A block carrying no text column (an image-only paragraph, a lone formula, a lone footnote
reference) is a stop for vertical travel wherever it can be entered as an object: one ArrowUp
enters it, selecting an image or opening the source of a kind that can show its markers, and the
next keypress moves on. ArrowDown reads it the same way. Both vertical directions must agree, or a
run of ArrowUps followed by the same number of ArrowDowns leaves the caret somewhere else.

A step-over widget (a decoded entity, an emoji shortcode) carries a column instead, so a paragraph
holding only one is a caret stop rather than an object stop: arriving puts the caret beside the
glyph, at the position a horizontal step across it already lands on, instead of taking the widget
as an object. The count is the same, one keypress in and one keypress out, in both directions.

Miss-analysis: the vertical-arrow handlers were tested only where the object block sat between
plain paragraphs in one block list, so the two entry points a vertical arrival crosses, the
per-block landing and a container's column entry, were never compared against each other, and each
carried its own answer.

Miss-analysis: a caret beside a non-editable inline widget has no rectangle of its own, and the
visual-line checks' offset fallback was unit-tested only with the caret inside a text node, the one
shape Chromium always measures; the e2e runs crossed only image blocks, where entering the object
replaces the caret, so nothing ever pressed Down on a caret placed beside a widget with no
rectangle.

Miss-analysis: every object-block row held a picture standing alone, so the vertical check read a
picture inside a link as a link (text, so a caret stop) while the edge entry, which looks inside a
link whose markers are hidden, would have selected it. On Chromium the caret placed there was
dropped, and the next key did nothing.

## Happy paths

- ArrowUp from below a details-wrapped image up to the paragraph above, then the same number of
  ArrowDowns: the caret returns to the paragraph it started in.
- ArrowDown from the paragraph above an entity-only paragraph stops in it once and leaves on the
  next keypress; ArrowUp from below takes the same two keypresses.

- A paragraph holding only a linked picture, in live and preview-inline mode, where the link's
  markers stay hidden until the caret is inside it: ArrowDown from above, ArrowUp from below,
  ArrowRight from the end of the block above and ArrowLeft from the start of the block below each
  select the picture, and a typed key replaces it inside the link (`[Q](https://x.y)`).
- The same paragraph in preview-block mode, which paints the markers once the block has the
  caret: ArrowDown lands a caret in the link's text, and a typed key leaves the picture alone.

## Edge cases

- The image is selected on exactly one keypress going up, and on exactly one keypress going down.
- Two adjacent entities, and a list item holding one entity-only paragraph, count the same as a
  lone entity. An entity followed by prose is an ordinary text block and counts the same.
- A caret stepped over the glyph by ArrowRight leaves the block on the first vertical keypress, up
  or down. A caret stepped between two adjacent glyphs, which touches no text node on either side,
  reads the same.
