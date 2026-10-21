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

## User interactions

- A range from the sixth paragraph's end down 30 paragraphs, PageDown: the range collapses to a
  caret a screen below the thirty-sixth paragraph
- A range three characters long inside the forty-first paragraph, PageUp: it collapses to a caret
  a screen up

## Miss-analysis

- PageDown left the caret in its own paragraph while the page scrolled away from it in Chromium and
  WebKit, and Firefox did nothing: each paragraph is its own editable element, which the browser's
  page step can't leave, and no row pressed a page key.
