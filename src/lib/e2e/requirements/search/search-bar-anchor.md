# Feature: Find/replace bar in a consumer-supplied anchor

`searchBarAnchor` lets the editor-owned bar render outside the editor root, for host-scroll
embeds where the default sticky position scrolls away with the document. Everything else stays
the editor's: the component, the Ctrl+F / Ctrl+H chords, Escape, and the pre-search caret
restore.

## Happy paths

- With an anchor supplied, Ctrl+F renders the bar inside the anchor element and nowhere inside
  the editor root; the find input still auto-focuses.
- Typing a query into the anchored bar paints the match highlights over the document.
- Ctrl+H opens the anchored bar with the replace row already expanded.

## Edge cases

- Theme tokens resolve inside the anchor: the bar computes to the token value, not to the
  component's inline fallback, even though the anchor sits outside every element that carries
  the theme.
- Switching the `theme` prop while the bar is anchored re-resolves those tokens live.
- In a themed host with no `.aragonite-editor-theme` anywhere, the moved bar still resolves the
  editor's own tokens (its focus ring and hover fills) to the current mode's value, light and dark. Miss-analysis:
  the only anchor test ran under the theme class, which declares those tokens for the bar, so
  nothing saw a light host's bar fall back to dark fills once the bar began reading them.
- Dropping the anchor mid-session returns the bar to the editor root with the bar still open
  and its query intact; re-supplying it moves the bar back.
- With no anchor supplied, the bar renders in the editor root exactly as before.

## User interactions

- Esc from inside the anchored bar closes it and restores the pre-search caret, so the next
  typed character lands where the user left off.
