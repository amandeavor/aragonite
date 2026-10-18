# Feature: The right-click menu reads the selection from the press

Safari selects the word, line break or whole element under a right-click before it sends
`contextmenu`. The editor decides which menu to open on whether the right button's press landed on
a selected range; what the clipboard rows act on (Cut and Copy, the Paste target) stays the live
selection, so Paste replacing a right-clicked word works as a native macOS right-click does.
The rows model Safari by setting the selection between a dispatched `mousedown` and `contextmenu`,
since Playwright's WebKit selects nothing on a right-click.

## Happy paths

- A divider Safari highlights whole opens the divider's block actions ("Copy divider").
- A word Safari selects in a code block opens the code block's actions, and the caret replaces
  the word so no highlight lingers under the menu.
- A word Safari selects in a paragraph opens the clipboard rows with the "Insert block" flyout, and
  the word stays selected with Copy enabled.
- A word Safari selects in a table cell is what the cell menu's Copy acts on.
- A real right-click inside a selection keeps it: the clipboard rows act on it, with no Insert
  flyout.

## Edge cases

- A press outside text selected elsewhere opens the block actions of the block under it, whether
  Safari then selects a word there or the browser leaves the old selection where it was.
- Every menu Paste route (prose Paste, Paste as plain text, Replace with clipboard, the cell's
  Paste) reads the clipboard only once its menu has left the page, so Safari's own Paste prompt
  never draws over an open menu.

## Miss-analysis

- The divider's and the code block's actions were unreachable by right-click in Safari (#745)
  because the menu read the selection at `contextmenu`, and no browser the suite drives selects
  under a right-click.
- The Paste prompt drew over the menu because each pick closed its menu by a state write and read
  the clipboard before the page updated; no row looked at the page when the read began.
- A right-click outside an existing selection opened that selection's clipboard rows, since the
  menu asked whether any range existed rather than whether the press landed on it; every
  right-click row pressed inside the range it had selected.
