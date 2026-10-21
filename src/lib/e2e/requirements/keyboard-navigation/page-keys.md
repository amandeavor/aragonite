# Feature: PageUp and PageDown move the caret a screen

PageUp and PageDown move the caret one screen of the editor up or down, at the column a run of
vertical keys keeps, into whichever block is there, and the caret ends on screen. Over a
selection, the selection collapses to where its moving end would step. On a Mac the page keys
scroll and leave the caret where it is, as every Mac text box does, so the spec skips there. A
step counts in one-line paragraphs: it lands within one paragraph of a screen's worth.

## Happy paths

- Sixty paragraphs, a caret inside the sixth, PageDown: the caret goes a screen down, on screen,
  and a typed letter lands in the paragraph it went to
- A caret inside the forty-first, PageUp: the same, a screen up

## Edge cases

- A caret in the fifty-sixth paragraph, PageDown: the caret stops in the last paragraph
- A screen's worth of paragraphs from the first one is a run of one-letter lines; from the
  twenty-first character of the first paragraph, PageDown lands on a one-letter line, and a second
  one lands past the run at the twenty-first character again
- Two hundred paragraphs, a caret in the third, and a second PageDown that arrives before the
  first has landed, as a held key's repeat can: the caret goes two screens down
- A two-column table of sixty rows, a caret in the second cell of its third row, PageDown: the
  caret goes a screen of rows down, in the same column

## User interactions

- A range from the sixth paragraph's end down 30 paragraphs, PageDown: the range collapses to a
  caret a screen below the thirty-sixth paragraph
- A range three characters long inside the forty-first paragraph, PageUp: it collapses to a caret
  a screen up

## Miss-analysis

- PageDown left the caret in its own paragraph while the page scrolled away from it in Chromium and
  WebKit, and Firefox did nothing: each paragraph is its own editable element, which the browser's
  page step can't leave, and no row pressed a page key.
- PageDown in a Firefox table cell did nothing: the step read the line nearest its target off the
  whole table, whose rows merge into one tall line there, and every table row started outside the
  table, in a one-column table.
- A PageDown that arrived before the one before it had landed did nothing: the step read the caret
  in the block the key was sent to, which the first step had just left, and every row waited for
  each press to land before the next.
