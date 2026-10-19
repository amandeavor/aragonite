# Feature: Cross-block selection through image widgets

## Happy paths

- Shift+ArrowRight at left boundary extends selection across the entire widget atomically
- Cross-block delete that includes a widget removes the entire widget source bytes
- Undo restores the widget after cross-block delete

## User interactions

- a pointer drag that starts on an image widget and moves into the next block enters cross-block mode: the widget's pointerdown no longer stops propagation, so the block's cross-block code sees the gesture
  (under Firefox and WebKit the spec marks this one `fixme` against #748, a fast drag that ends on a stale endpoint)
