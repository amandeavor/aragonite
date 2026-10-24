// @vitest-environment jsdom
// How the spec examples, the showcase and the changelog parse, and keys at each join of their
// adjacent blocks, held to the committed rows.
import { beforeAll, it } from 'vitest';
import { installLayoutStubs } from '#lib/test/harness/mount-editor.svelte.js';
import { documentRows } from './strata';
import { holdRowsToBaseline } from './rows';

beforeAll(installLayoutStubs);

it('reads and edits the documents the way the committed baseline says', async () => {
	holdRowsToBaseline('docs', await documentRows());
}, 600_000);
