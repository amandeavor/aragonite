# Feature: Text Editing, Forward Delete

Forward Delete merges with the next block when at end-of-block; otherwise deletes the next
character, which `collapsed-delete-class.md` pins on every engine. The merge itself is driven
through a list item in `blocks/list/backspace/delete-forward.md` and its bytes are pinned at the
tree level; what stays here is what the key does before a block no merge reaches.

## Edge cases

- Delete before a thematic break focuses it (whole-block focus), no byte change; a second Delete removes it
- Delete before a non-mergeable heading does not merge; it moves focus to the next block
