# Block: List, Hanging Indent

The first prose child of a list item that wears a leading marker gets a hanging indent: a left padding the marker fills on the first line, so wrapped lines hang under the content rather than under the marker. The indent is one `ch` of the line's font per marker character, except where a marker draws itself: in the rendered modes a to-do reserves what its painted box takes. How the indent lines wrapped text up is `marker-column.md`.

## Edge cases

- A to-do reserves, in source mode, an indent at least as wide as the glyphs of its widest marker (`- [X] `) drawn there. A to-do can no longer start with a heading: the parser reads `- [ ] # x` as text, and cycling the item to a heading drops the marker.
  - Miss-analysis: the indent cases all ran on a first child at the editor's own text size, where every way of writing the width gives the same number, so nothing measured the indent against a marker that draws wider than the editor's base.
- Non-first prose children carry no hanging indent.
