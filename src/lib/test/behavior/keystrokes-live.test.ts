// @vitest-environment jsdom
// Every key at every offset of the small documents in live mode, held to the committed rows.
import { beforeAll, it } from 'vitest';
import { installLayoutStubs } from '#lib/test/harness/mount-editor.svelte.js';
import { keystrokeRows } from './strata';
import { holdRowsToBaseline } from './rows';

beforeAll(installLayoutStubs);

it('presses each key where the committed baseline says it lands', async () => {
	holdRowsToBaseline('keys live', await keystrokeRows('live'));
}, 600_000);
