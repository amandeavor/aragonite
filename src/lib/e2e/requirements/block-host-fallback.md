# Feature: BlockHost no-view fallback

A block kind whose view this editor can't resolve must render a visible raw-editable
block, not nothing. Every kind registers with its view, so a block gets here only when
its kind's plugin isn't active in this editor: the editor's `plugins` list leaves it out,
or its setup threw after registering the kind (the route these cases take). The node
still serializes, so nothing is silently dropped from the display.

## Happy paths

- orphan kind renders visibly: a top-level node whose kind resolves no view shows a non-empty block (its raw text in a contenteditable), not an empty wrapper
- orphan kind still serializes: `getSource()` retains the orphan node's raw text after it renders via the fallback
