# Feature: a drag out of a shown render-primary source folds it

A render-primary leaf (block math, the outline, a footnote definition) shows its source while the
caret is in it. A drag that starts in that source and leaves for another block ends a range across
blocks, and the release puts focus in the block it ended on. The source then has nothing focused in
it, so it folds back to its rendered view, while the range stays.

## Happy paths

- Open a block equation's source, drag from inside it to the paragraph below, release: the source
  folds, the rendered equation is back, and the range across blocks is still live.
- Ctrl+C on that range copies what lies between its two ends: the source's bytes from where the
  drag began, the blank line, and the paragraph up to where it ended. The document is unchanged.

## Regressions

- The fold waited a frame after the release (a `requestAnimationFrame`), where the editor's one
  timing rule allows only an awaited tick. Miss-analysis: no spec dragged out of a shown source, so
  the frame wait had no test saying what it was for; a fold with no wait at all passes these rows
  too, which is why an awaited tick is enough.
