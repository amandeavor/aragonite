# Feature: Report a bug from the showcase

The `/` showcase header's "report a bug" button records the visitor's input and opens GitHub's bug form with the recording attached. It never files the issue; the visitor reads the form and submits it.

## Happy paths

- Press the button: a card says the recording includes everything typed and the whole document's text, and that a submitted issue is public. Start recording turns the button into "stop and report"; typing, then pressing it, opens `issues/new?template=bug.yml` in a new tab with `where` (version, browser, OS, mode) filled in. The showcase's own document is too long for a link, so the recording (with text) goes on the clipboard, fenced, and the form's Recording field says to paste it.

## User interactions

- Cancel on the card closes it and records nothing; the button reads "report a bug" again.

## Pinned below the browser

- A recording short enough for the link rides the URL itself, and one too long for an issue body downloads as a file instead (`test/debug/bug-report-link.test.ts`).
