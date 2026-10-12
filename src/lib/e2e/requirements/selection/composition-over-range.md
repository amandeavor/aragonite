# Feature: IME composition over a range across blocks

A composition that starts while a range across blocks is selected removes the range first, the
way a plain delete would, then composes in the block the removal kept. The browser's caret can
sit in any block the range touches when the composition starts (Ctrl+A twice leaves it in the
last block, and a range drawn upward leaves it where the drawing started), so the removal often
takes the very block the composition started in. Every scenario runs in source and live mode,
through a real CDP composition.

## Happy paths

- Compose `か`, then `かん`, then commit `漢` over each range below. While composing, the source
  holds the removal and nothing else. The commit lands `漢` once, in the kept block, with the caret
  right after it, and one Ctrl+Z puts the document back the way it was.
  - the whole document, selected with Ctrl+A twice
  - first block to last, drawn upward, so the caret starts in the last block
  - the last block alone, drawn upward from its end into the end of the block before
  - first block to last, drawn downward, so the caret starts in the block the removal keeps
  - both paragraphs of a quote, which the removal empties
  - both items of a list, which the removal empties

## Edge cases

- An abandoned composition (compose `か`, then commit nothing) over each of those ranges leaves the
  removal and types nothing.
- Miss-analysis: the only composition row over a range drew it downward, so the caret sat in the
  block the removal keeps, and no row composed over a range whose removal took the caret's block.
