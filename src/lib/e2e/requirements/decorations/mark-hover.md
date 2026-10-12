# Feature: Mark hover

A mark whose `interactive` declares `onHover` reports the pointer entering it, with the rect under
the pointer as the anchor and every rect it paints, and reports `null` once the pointer has left
it. Hover is a hit-test of the pointer against the painted rects, so a hover-only mark renders
nothing that takes the pointer and the text under it edits as usual. A hover is keyed by the
decoration, not by a painted rect, so a repaint never fires a leave and an enter, and every
started hover ends exactly once, whatever ends it. Sources register through the e2e bridge; the
pointer aims at the text the mark covers, through Playwright's mouse.

## Happy paths

- The pointer moves onto a one-line mark: one `onHover` whose anchor sits on the marked word;
  moving off it: one `null`
- A mark wrapped across two lines: moving from its first line to its second, straight down across
  the space between the lines, fires nothing; moving off both fires one `null`

## User interactions

- A click inside a hover-only mark places the caret at the clicked offset
- A drag starting inside a hover-only mark selects text, and the hover ends when the button goes
  down; crossing another hover mark while pressed starts no hover
- A double-click inside a hover-only mark selects the word
- A right-click inside a hover-only mark places the caret there and opens the editor's menu
- The cursor over a hover-only mark is the text cursor, not a hand
- A touch tap on a hover mark places the caret and starts no hover
  - Miss-analysis: the first rows drove hover through the overlay elements, so none clicked,
    dragged or tapped the text under a hover mark, and a hover mark taking the pointer passed

## Edge cases

- Hover started, then the source invalidates and returns the same mark (a new object, a changed
  class) while the pointer stays still: no `null` and no second hover; invalidated so the mark is
  gone: exactly one `null`
- Hover started, then the document scrolls a little under the still pointer, moving the mark out
  from under it: exactly one `null`
- Hover started, then the document scrolls far enough that the hovered block leaves the rendered
  range: exactly one `null`
- Hover started, then `loadContent` replaces the document: exactly one `null` for the old
  document's mark (a mark the new document puts under the still pointer starts a hover of its own)
- Hover started, then the host unmounts the editor: exactly one `null`
- Two overlapping hover marks, the outer from a source registered later: the pointer over the
  inner one's range hovers the inner one, the same mark the keyboard's activate command picks
- A host popup inside the editor root covering another mark: moving onto it ends the hover and
  starts none for the covered mark
- A menu a table opens over its own cells: moving onto it, over a cell carrying a hover mark, ends
  the hover and starts none for that cell
  - Miss-analysis: the popup row put its popup outside every block, and no row covered a menu a
    block renders inside itself
- Two hundred plain marks, a keyboard-only mark, two hover-only marks and two click marks: exactly
  the two click marks' overlays take pointer events

## Error cases

- An `onHover` that throws reaches the `error` event as origin `decoration`, and the editor keeps
  working: a typed character still lands
