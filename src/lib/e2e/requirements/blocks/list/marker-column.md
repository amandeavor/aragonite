# Feature: the list marker's column

A list item draws its marker (`-`, `1.`, a checkbox) in a column of its own, and the item's text starts at that column's right edge on every line. The marker takes the size of the line it labels, and its column is sized in that line's font, so a heading item's number reads as part of the heading. The marker sits beside the item's first line, whatever that line holds.

## Happy paths

- A bullet, ordered (`1.`, `9.`, `10.`, `100.`), unchecked or checked task item whose text runs onto a second line (a hard break): the second line's text starts where the first line's text starts, within half a pixel, in source, live, reading and block preview modes
- A long ordered or bullet item that soft-wraps: the wrapped line starts under the first line's text, in source and live modes
- A long heading item (`1.`, `10.`, `100.`, `-`): its wrapped line starts where its first line's text starts, and its marker draws at the heading's size, in source, live and reading modes, and at the heading's weight where markers render (source mode draws every marker at plain weight)

## Edge cases

- A bullet, ordered (`1.` to `100.`) or to-do item in source mode, an ordered item in live mode, and an ordered heading item (`1.` to `100.`) in both: the marker text the mode paints ends before the item's text starts, so a wider marker widens its column instead of running under the text
- A nested ordered or to-do item inside a bullet item, or a nested bullet inside an ordered item: the nested item paints only its own marker (no `•` beside its number or box, no `- ` bytes beside its bullet), in live and reading modes
  - Miss-analysis: every presentation row ran on a flat list, and the marker rules reached any marker under an item of their kind, so the outer item's paint leaked onto nested items of another kind.
- An item whose first line is a picture (`1. ![pic](x)`): the marker's top sits at the picture's top, not at its bottom, in source, live and reading modes
- A picture with a caption after it (`1. ![pic](x) caption`): the marker sits at the picture's top, not on the caption line below it
- Text first, a picture later in the same paragraph (`1. lead ![pic](x)`): the marker sits on the text line, not at the picture's bottom
- A text item: the marker sits on the first line

## User interactions

- Click an empty bullet, ordered or to-do item, press End, type: the letter lands in the item, in source and live modes (the marker's box never takes the caret)

## Miss-analysis

- The hanging indent was one `ch` per marker character while the marker paints in a proportional face, so the first line's text started where the glyphs ended and the wrapped lines started at the indent, up to 15px apart. No list test measured geometry; they checked bytes and metadata, and the one layout row for pictures pinned the marker to the picture's bottom.
