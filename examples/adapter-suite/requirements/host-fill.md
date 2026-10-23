# Feature: the editor fills the box it's mounted in

Every app's page-contract page (`page-contract.md`) gives the framework component a height through
its `style` alone, on a plain element (no flex layout), and its `load-long` button loads a
300-paragraph document. The Svelte component and `createEditor` hold the same rule in the main e2e
suite (`src/lib/e2e/requirements/host-fill.md`), since no one app runs all four.

Miss-analysis: the apps' height went untested; every check typed into a two-line note, which fits
any box, and the one long document (`?block-views`) sat in a flex column the page added for it.

## Happy paths

- A host with a fixed height and a long document: the editor's scroll container is no taller than
  the host, a wheel over it scrolls the editor and not the page, and fewer blocks are mounted than
  the document holds (windowing is on). Counted by mounted blocks: the root's `data-windowing`
  reads `active` even when every block fits.
