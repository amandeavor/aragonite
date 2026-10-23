// Takes an input recording the debug panel's Send button posts, for a phone on the LAN where the
// clipboard and file sharing need a secure origin. Development builds only; a prod build answers 404.
import { error, json } from '@sveltejs/kit';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readInputRecording } from '#lib/debug/input-recording.js';
import { devChecksOn } from '@voithos-labs/aragonite/dev-checks';

const INBOX = 'recordings-inbox';

export async function POST({ request }) {
	if (!devChecksOn) error(404);
	let recording;
	try {
		recording = readInputRecording(await request.text());
	} catch (e) {
		error(400, e instanceof Error ? e.message : String(e));
	}
	const platform = recording.env.uaData?.platform ?? 'unknown';
	const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${platform}.json`;
	mkdirSync(INBOX, { recursive: true });
	writeFileSync(path.join(INBOX, name), JSON.stringify(recording, null, '\t') + '\n');
	return json({ saved: `${INBOX}/${name}` });
}
