# Feature: Mark hover

A mark whose `interactive` declares `onHover` reports the pointer entering it, with the rect it
entered as the anchor and every rect it paints, and reports `null` once the pointer has left it.
The editor keys a hover by the decoration, not by the rect it painted, so a repaint never fires a
leave and an enter, and every started hover ends exactly once, whatever ends it. Sources register
through the e2e bridge, and the pointer moves through Playwright's mouse.

## Happy paths

- The pointer moves onto a one-line mark: one `onHover` whose anchor sits on the mark's painted
  rect; moving off it: one `null`
- A mark wrapped across two lines: moving from its first line's rect to its second's, across the
  space between the lines, fires nothing; moving off both fires one `null`

## Edge cases

- Hover started, then the source invalidates and returns the same mark (a new object, a changed
  class) while the pointer stays still: no `null` and no second hover; invalidated so the mark is
  gone: exactly one `null`
- Hover started, then the document scrolls far enough that the hovered block leaves the rendered
  range: exactly one `null`
- Hover started, then `loadContent` replaces the document: exactly one `null`
- Hover started, then the host unmounts the editor: exactly one `null`
- Two overlapping hover marks, the outer from a source registered later: the pointer over the
  inner one's range hovers the inner one, the same mark the keyboard's activate command picks
- Two hundred plain marks and one keyboard-only (`onActivate`) mark: no overlay takes pointer
  events

## Error cases

- An `onHover` that throws reaches the `error` event as origin `decoration`, and the editor keeps
  working: a typed character still lands
