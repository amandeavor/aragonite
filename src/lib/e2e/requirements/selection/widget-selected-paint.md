# Feature: a widget selected whole shows that it is

An inline widget the editor holds selected whole wears the selection wash, the same tint a text
selection gets, so the key that replaces it never replaces something the user couldn't see. A
line break has no box of its own, so it shows as a narrow block at the end of the line it breaks.
An image whose editing ring is up keeps the ring alone.

## Happy paths

- A live `<br>` selected by ArrowRight from its start, in a paragraph, a heading, a list item and
  a quote child: the break wears the wash, at least a few pixels wide and no taller than its line.
- A chip (a plugin widget that never shows its source) selected by Mod+K beside it, in a
  paragraph, a heading, a list item, a quote child and a table cell: the chip wears the wash over
  its box.
- An image clicked in reading mode, where no ring mounts: the image wears the wash.

## User interactions

- A `<br>` or a chip selected and wearing the wash, then a typed letter: the letter replaces the
  widget, as the selection promised.

## Edge cases

- A table cell steps over a `<br>` and draws an image as its source, so neither is selected
  whole there and neither has a cell row.

## Miss-analysis

- Every spec of a selected widget asserted what a key did to it (replace, copy, Shift+click), and
  the one paint spec selected an image, whose ring the overlay draws; nothing asserted a mark on
  any other shape, and the painter cleared its class while a widget was held.
