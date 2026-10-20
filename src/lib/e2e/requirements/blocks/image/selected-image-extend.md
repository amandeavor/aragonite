# Feature: Shift keys extend from a selected image

A click on an inline image selects it whole. A Shift key that grows a selection, pressed there,
grows it from the image and never drops the image: the selection is anchored at the image's far
edge from the key's direction, and its moving end goes the key's way, as Shift+Arrow from a range
keeps its anchor. Shift+Left and Shift+Right stay the image's resize.

## Happy paths

- Shift+ArrowUp selects from the image's end up past its start, so a typed letter replaces the
  image and the text before it and keeps the text after
- Shift+ArrowDown selects from the image's start down past its end, keeping the text before
- Shift+PageUp and Shift+PageDown anchor the same way and move by the browser's page

## Edge cases

- The image's toolbar goes once the key extends, since the image is part of a text range now
- Shift+Home, Shift+End, Mod+Shift+Home and Mod+Shift+End, and their Cmd+Arrow spellings, are the
  caret-edge chords' rows (`keyboard-navigation/edge-chords.md`)

## Miss-analysis

- Every Shift key but Shift+Left and Shift+Right did nothing on a selected image, and Mod+Shift+End
  in Chromium extended from the block's start, so a typed letter took text that was never selected:
  the selected-image specs pressed only the plain keys, and no row pressed an extend on the image
