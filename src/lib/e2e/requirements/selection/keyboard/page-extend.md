# Feature: Shift+PageUp and Shift+PageDown grow a selection a screen at a time

Shift+PageUp and Shift+PageDown move the selection's moving end one screen of the editor up or
down, at the column a run of vertical keys keeps, onto the line there. The anchor stays put, and
the end lands on screen, the way Shift+ArrowUp and Shift+ArrowDown move it a line. A step counts in
one-line paragraphs: it lands within one paragraph of a screen's worth.

## Happy paths

- Sixty paragraphs, the caret at the end of the sixth, Shift+ArrowDown 30 times, then
  Shift+PageUp: the end goes a screen up from the thirty-sixth paragraph, the anchor still at the
  sixth's end, and it's on screen
- The same range, then Shift+PageDown: the end goes a screen down
- A caret inside the sixth paragraph, Shift+PageDown: a range grows out of the block, anchored at
  the caret, its end a screen down
- A range three characters long inside the forty-first paragraph, Shift+PageUp: the end goes a
  screen up and the anchor stays where the range started

## Edge cases

- Two hundred paragraphs, a range to the document's end, then a scroll to the top, which
  takes the end's paragraph out of the rendered window: Shift+PageUp steps the end a screen up
  from where it was, and brings it on screen
- A range ending ten paragraphs from the document's end, Shift+PageDown twice: the end stops on
  the last paragraph
- A caret in the third paragraph, Shift+PageUp: the end stops on the first paragraph
- A screen's worth of paragraphs from the first one is a run of one-letter lines; from the
  twenty-first character of the first paragraph, Shift+PageDown lands on a one-letter line, and a
  second one lands past the run at the twenty-first character again, not at the short line's end
- Twenty paragraphs and then a quote of forty, from the sixth paragraph's end: two Shift+PageDown
  go into the quote's paragraphs, and a third goes on through them
- A one-column table of sixty rows, a range from the paragraph above it into its sixth row:
  Shift+PageDown takes a screen of rows

## User interactions

- Shift+PageUp and Shift+PageDown pressed on the keyboard

## Miss-analysis

- Shift+PageDown did nothing over a range across blocks, and Shift+PageUp moved the browser's caret
  inside the anchor's paragraph and scrolled the end off screen: every extend row pressed an arrow,
  Home, End or a document edge, and no row pressed a page key.
