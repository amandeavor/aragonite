# Feature: a caret typed into a widget that can show its source

Typing a widget's opening byte in front of text that completes it (`#` before `few`, `[` before
`^a]`) closes a widget around the caret. A widget whose kind can show its source opens that source
with the caret where it was, one past the typed byte, instead of being pushed past the new widget.
The kinds here are every one registered with `revealSource` and no content span: the harness tag
(limestone's registration, value for value), the footnote reference, the harness wikilink and the
inline directive.

## Happy paths

- For each kind, in source and live mode: typing the opening byte before an existing body leaves
  the caret one past it, the bytes hold the completed construct, and the block shows its source,
  not a rendered widget, still after the render settles.

## Edge cases

- Backspace on the space of `# few words here` turns the heading back into a paragraph opening
  with the tag `#few`: the caret stays at 1, inside the tag, with its source shown.

## User interactions

- In a table cell, `#` typed at the start of `few` leaves the caret at 1 with the source shown, as
  in a paragraph.

## Error cases

- no `[invariant:…]` console messages, the caret landing check (G1.115) included

## Miss-analysis

- Every tag test typed a tag at a line's end (` #fresh`), so no row typed an opening byte in front
  of a body that completes it, and no row covered a widget kind with `revealSource` but no content
  span: latex, the one kind with a span, hid the gap.
