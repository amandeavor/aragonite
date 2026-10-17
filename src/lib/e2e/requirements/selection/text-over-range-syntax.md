# Feature: Text over a range lands where the range was

When a range takes the block it started in (a table held whole, say), the caret the removal leaves
sits in the block beside the range. If that caret is on the block's syntax rather than its text
(a fence, a heading's `#`, a rule, an HTML tag), text typed, pasted or composed over the range
goes in a new paragraph where the range was: before a block below it, after a block above it.
Where the caret is on text, the text joins the block there.

## Happy paths

- Click the cell of a one-row table and press Shift+Down, so the range takes the table and stops
  at the first byte of the block below. Type `x`, paste `x`, or compose `か` and commit `漢`. The
  text stands in a paragraph of its own where the table was, the block below keeps its bytes and
  its kind, and the caret sits right after the text. The block below is each of:
  - a heading, `# Head`
  - a fenced code block, which keeps its closing fence
  - an HTML block
  - an indented code block
  - a rule
  - a math block, with latex installed
  - a diagram, with mermaid installed
  - a list item opening with a fenced code block: the paragraph goes before the list
- A fenced code block or a rule, then two one-row tables. Click the first table's cell and press
  Shift+Down, so the range takes both tables and the caret falls back on the end of the block
  above. Each gesture puts its text in a paragraph after that block, never after its closing fence
  on the same line.

## Edge cases

- The same range down into a paragraph, a setext heading, a quote or a list: the caret is on the
  block's text, so the text joins it there (`xplain`, `xHead` over `===`, `> xq`, `- xli`).
- The composition row into the list item's paragraph is skipped: a composition there drops its
  text, a defect of its own.
- An abandoned composition (compose `か`, commit nothing) over the table and the heading below
  leaves the removal and the empty paragraph it opened.

## User interactions

- One Ctrl+Z after each gesture puts the table and the block back and the range back as drawn:
  the removal, the opened paragraph and the text are one undo entry.

- Miss-analysis: every typed-over-range row kept a block with text at the caret, or a rule whose
  typed key took a route of its own, so no row typed, pasted or composed at a caret sitting in
  front of a block's opener or past its closing fence.
