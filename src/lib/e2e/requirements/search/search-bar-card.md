# Feature: The find bar's card

The open find bar is one card that is itself the find field: the query, the count, then the
toggles, the step arrows, the replace toggle and close, all on one line at the card's set width.

## Edge cases

- An invalid regex shows its message in the count, cut short, and the card keeps its one-line
  height; the full message stays in the count's tooltip. Miss-analysis: the error test checked the
  count's text and class, never the card's size, so a message long enough to push the controls
  onto a second line passed.

## User interactions

- With focus inside the card, its edge is a ring at 3:1 or more against the card and against the
  page behind it, in the dark theme and the light one. Miss-analysis: no test measured the ring,
  and its dark-theme colour was 5% white, which reads as no ring at all.
- A click on the count, or on the card's empty space, puts focus in the find field and keeps the
  query. Miss-analysis: the editor read a press on the bar's bare parts as a click in the document
  under it and moved focus there, and no test clicked anywhere on the bar but a control.
