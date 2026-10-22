# Feature: a range edit that reaches a container out of the window

A long document windows its blocks: only the ones near the viewport are mounted.
A range can still end inside a container that isn't mounted, a table at the
bottom of 200 paragraphs, say. Such a container commits by the ids its node
holds. It isn't found in the registry of container states, and nothing reads
the state its unmounted component left behind.

Each row also checks, at the end, that every container state the registry
finds belongs to a mounted container, and that the document round-trips.

Miss-analysis: every range test ran on a document short enough to mount whole,
and the registry kept a windowed-out container's dead state, so the unmounted
case read like the mounted one (issue #760).

## Happy paths

- Shift+Mod+End from inside paragraph 3 of 200 paragraphs and a table, then
  Delete and typing `x`: the paragraphs after the caret and the table go, and
  `x` lands at the caret
- the caret in a table cell after scrolling to the bottom, Shift+Mod+Home so the
  table leaves the window, then Delete and typing `x`: the bytes match the same
  gesture over a three-block document where the table stays mounted
