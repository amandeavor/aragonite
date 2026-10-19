# Feature: Keyboard Navigation, Caret-Edge Chords

Home and End move the caret to a line's edge, and with Ctrl (Cmd on a Mac) to the edge of the
block's text. On a Mac, where Home and End scroll the page, the same moves are Cmd+Left, Cmd+Right,
Cmd+Up and Cmd+Down. Every place the editor steps in on one of these keys reads both spellings the
same way; neither spelling changes what the other does.

## Happy paths

- The line start in a paragraph opening with an image lands before the image, so a typed letter
  goes ahead of it: Home and Cmd+Left alike
- Extending to the line start there takes the image too: Shift+Home and Cmd+Shift+Left
- The block start there lands before the image as well: Mod+Home and Cmd+Up
- The block end of a paragraph ending in an image lands past the image: Mod+End and Cmd+Down
- The line end past a code chip ending the line types outside the chip, in live mode: End and
  Cmd+Right
- The line start from a selected image leaves the image and types at the line's start: Home and
  Cmd+Left
- Extending to the document's end from a caret takes every block after it: Mod+Shift+End and
  Cmd+Shift+Down

## Edge cases

- Cmd+Up on a paragraph's first line keeps the caret in its block instead of stepping to the block
  above, as a plain ArrowUp would
- Cmd+Left at a block's start keeps the caret in its block instead of stepping to the block before
- Cmd+Up in a table cell keeps the caret in its cell instead of stepping to the cell above
- Ctrl+Left on Windows and Linux still steps one word, never to the line start, even in a
  paragraph opening with an image, where the editor places the line start itself

## User interactions

- Each row sends its chords literally on every engine, so the Cmd+Arrow reading runs on every Linux
  push, not only on the macOS run
  - On macOS the Home and End spellings of the rows where the browser moves the caret itself (the
    code chip, the selected image) skip, since macOS scrolls on those keys instead

## Miss-analysis

- Five editor sites each compared Home or End, so Cmd+Arrow on a Mac reached none of them: a
  line start beside a leading image landed past it, and Cmd+Up hopped a block. Every spec pressed
  Home and End, and the one macOS run read Home as a scroll, so nothing ever sent Cmd+Arrow.
