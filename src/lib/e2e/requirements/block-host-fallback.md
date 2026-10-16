# Feature: BlockHost no-view fallback

A block kind whose view this editor can't resolve must render a visible raw-editable
block, not nothing. Every kind registers with its view, so the way a block gets here is
a kind whose plugin's setup threw after registering it: the plugin never installs, and
nothing it registered resolves. The node still serializes, so nothing is silently
dropped from the display.

## Happy paths

- orphan kind renders visibly: a top-level node whose kind resolves no view shows a non-empty block (its raw text in a contenteditable), not an empty wrapper
- orphan kind still serializes: `getSource()` retains the orphan node's raw text after it renders via the fallback
