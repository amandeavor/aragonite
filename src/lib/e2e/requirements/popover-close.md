# Feature: Every popover closes without its opener holding focus

The editor's popovers (the block menu and its flyout, the code block's overflow menu and language
picker, the table menu, the link card, the image's alt field, the inline menu) close on a press
outside them and on Escape. Safari never focuses a clicked button, so focus may be on the page body
when either arrives; the rows run under Chromium and in the WebKit lane.

## Happy paths

- Each popover, opened the way a user opens it, closes on a press on plain text in another block.
- Each closes on a press on an image in another block.
- Each closes on a press on another block's chrome (a different code block's Copy button).
- Each closes on Escape.

## Edge cases

- Escape with the block menu's flyout open closes the flyout and leaves the menu open.
- With the code block's overflow menu opened from the keyboard, Shift+Tab out of the gutter closes
  it.
- The selection toolbar's heading flyout, opened by hovering "Set heading", stays open under the
  click that follows the hover; Escape then closes the flyout and leaves the bar and the selection.
- A link card opened beside a live caret, with the caret walked into a formula that shows its
  source: one Escape closes the card and the shown source both, since a card not holding focus
  leaves the key to the document.

## Miss-analysis

- The code block's overflow menu stayed open in Safari (#686) because it closed on the gutter's
  focus leaving and read Escape on the focused button; every menu spec ran in Chromium, which
  focuses a clicked button, so no row ever closed a popover with focus on the page body.
- Moving the overflow menu's close onto the menu presence dropped its close on Shift+Tab out of the
  gutter; no row drove the menu from the keyboard.
- The toolbar's heading flyout toggled shut under the click that follows its hover, and Escape
  never reached it; it was left out of the close as hover chrome, and every toolbar row opened it
  by hover alone.
