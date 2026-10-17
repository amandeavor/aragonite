# Sticky column: a line that starts after a line break

A caret right after a `\n` sits at the start of the next line for every vertical move: the column
search that lands a caret entering a block from below, and the check for whether the caret is on a block's
first or last line. Code blocks have their own rows (`code-block-entry.md`).

## Happy paths

- a paragraph, an HTML block `<div>`, 30 `b`, `</div>`, and a paragraph, in source mode: caret at
  the start of the last paragraph, ArrowUp lands at the start of the `</div>` line

## Edge cases

- a paragraph, then the paragraph `abc` / `xyz` (a soft line break): caret at the start of `xyz`,
  ArrowUp lands at the start of `abc`, not in the paragraph above

## Miss-analysis

- Only Chromium gated, and Chromium measures a caret right after a `\n` on the line below (or not
  at all), so no run saw WebKit and Firefox measure a line's start on the line above, which landed
  a column search at a body's start and read a second line's start as the first line.
