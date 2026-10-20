# Feature: Undo with focus on editor chrome

Keyboard focus can sit on a button in the editor's own chrome: a Tab walk reaches the trailing
insert row, a selected image's toolbar, a code block's rail, a table's add-row button and a details
block's toggle. Mod+Z and Mod+Shift+Z still step the editor's history from there, one entry per
press, on every engine.

## Happy paths

- With a chrome button focused after two edits, Mod+Z takes back only the last edit, and
  Mod+Shift+Z puts it back: the trailing insert row, the image toolbar, the code rail (live mode),
  the table's add-row button, the details toggle, and the find bar's buttons when the host mounts
  the bar outside the editor (`searchBarAnchor`)

## Edge cases

- A text field inside the editor (the image's Alt field, the find bar) keeps its own Mod+Z for its
  own text

## Miss-analysis

- In Firefox, Mod+Z with focus on an image toolbar button undid nothing, while Chromium and WebKit
  undid through their own history on the block last edited: the toolbar specs pressed Mod+Z only
  after focus was back on the paragraph, and no row pressed it with focus on chrome
- Mod+Z with focus on a button of a find bar the host mounted outside the editor undid nothing in
  Chromium or Firefox: the rows only reached chrome inside the editor root, which is all the fix
  checked
