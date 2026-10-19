# Feature: Focus after an image toolbar sub-mode

The image toolbar has two sub-modes: the Alt text field and the crop. However one ends, the image
stays selected with its paragraph focused, the same as right after a click on the image, so the
editor's keys reach it there.

## Happy paths

- After each way a sub-mode ends, Mod+Z undoes the last edit and Mod+Shift+Z redoes it:
  - the Alt field closed by its own button, by Enter, by Escape, or by starting a crop
  - the crop applied by Enter or its tick, or cancelled by Escape or its cross
- After each of those ends, Escape dismisses the image: the toolbar goes, as on a freshly clicked
  image

## Edge cases

- Escape inside the Alt field drops its draft and leaves the image selected; only the next Escape
  dismisses the image
- Remove, with the Alt field open or closed, leaves typing in the image's paragraph where the image
  was

## User interactions

- Pressing a toolbar button leaves focus on the image's paragraph; only the Alt field's input takes
  focus, and it hands focus back when the field closes from the toolbar or its keys

## Miss-analysis

- Closing the Alt field with its button left Mod+Z undoing nothing in every engine, and Escape
  after any other end dismissed nothing: each sub-mode had its own focus test or none, and no test
  pressed Escape after an end at all, so a fix to one end's Mod+Z moved the other key's break
  instead of closing it
- Remove with the Alt field open left typing going nowhere, since the field's input went with the
  image, and Remove landed no caret, so typing went to the line's start or nowhere: the class rows
  ended each sub-mode on its own, none by removing the image, and none typed after a Remove
