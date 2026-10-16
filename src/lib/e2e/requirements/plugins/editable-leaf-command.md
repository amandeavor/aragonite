# Feature: plugin-registered block commands on an editable leaf

A plugin registers a `(kind, id)` block command and binds it in the keymap of a kind built with
`createEditableLeaf`. Pressing the bound chord over the focused leaf resolves the command
through the same code the bubble-to-the-container path uses, and runs it against the focused
node. A leaf's metadata is whatever its opener reads out of its bytes, so a leaf's command
changes it by rewriting the bytes with `replaceRaw`. A handler that throws is caught where
commands are dispatched: the keypress does nothing and reports one `origin: 'command'` error on
the editor's event channel rather than an uncaught page error. The seed is the `%%` memo harness
kind (commands `memo.tag` on `Mod+Shift+K`, which rewrites `%%` to `%%!`, and `memo.boom` on
`Mod+Shift+J`), driven by real keyboard input only.

## Happy paths

- A registered command bound on the memo leaf fires on the leaf's own path: pressing its chord
  over the focused memo rewrites its bytes to the tagged form, its metadata reads tagged, and
  loading the source again keeps the tag. Before this existed, a leaf ignored such commands.
  Miss-analysis: this scenario asserted the old contract (the tag stayed out of the bytes, and
  the dev read-back warning was expected), so the spec held the lost tag in place as the
  behavior.

## User interactions

- Typing in the memo, then pressing the chord, then one undo: the typed text stays and only the
  tag goes, since the command is its own undo entry.

## Error cases

- A registered handler that throws is caught: pressing its chord reports exactly one `error`
  event of origin `command` on `getEvents()`, no uncaught `pageerror` fires, and the editor
  stays usable, so the next keystroke still commits
