// @vitest-environment jsdom
// Seeded runs of keys into one mount, then undoing and redoing them all, held to the committed rows.
import { beforeAll, it } from 'vitest';
import { installLayoutStubs } from '#lib/test/harness/mount-editor.svelte.js';
import { sequenceStratum } from './strata';
import { holdRowsToBaseline } from './rows';

beforeAll(installLayoutStubs);

it('replays each seeded sequence the way the committed baseline says', async () => {
	holdRowsToBaseline('seq', await sequenceStratum());
}, 600_000);
