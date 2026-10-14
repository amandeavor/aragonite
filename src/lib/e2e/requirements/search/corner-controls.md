# Feature: Block controls beside the open find bar

A block's hover controls in its top-right corner (a code block's language picker and copy button,
a diagram's toolbar, an equation's layout toggle) sit where the open find bar does. The bar moves
the ones it covers below itself and leaves every other one where it was.

## Happy paths

- With a code block at the top of a live-mode document, the open bar leaves the block's controls
  uncovered: hovered, they show below the bar. Miss-analysis: the rule that moves them named the
  language picker, which stopped being the positioned element when the controls were grouped, and
  no test measured the two boxes, so the rule matched and did nothing.
- The same holds with the replace row showing, whether the bar opened with it or it was expanded
  after. Miss-analysis: the move was a fixed distance sized for the find row alone, and every test
  opened the bar with Ctrl+F.
- Closing the bar puts the moved controls back where they were.

## Edge cases

- A one-line code block further down, hovered while the bar is open, shows its controls in their
  usual place. Miss-analysis: the only test opened the bar over one code block at the top, so a
  rule that moved every code block's controls passed it.
- A code block scrolled up under the open bar, then hovered, shows its controls below the bar.
  Miss-analysis: no test scrolled a block under the bar, where a move measured from the block's
  own top falls short of the bar's bottom edge.
- A diagram at the top of the document, hovered with the bar open, shows its toolbar below the
  bar. Miss-analysis: the rule named the code block's controls alone, and no test put another
  block's corner control under the bar.
- An equation at the top, opened for editing and hovered with the bar open, shows its layout toggle
  below the bar. Miss-analysis: as for the diagram.
