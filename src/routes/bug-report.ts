/**
 * The showcase's "report a bug" link: GitHub's new-issue form for `bug.yml`, its `where` and
 * `recording` fields filled from the query string. A recording too long for the URL goes on the
 * clipboard instead, and one too long for an issue body downloads as a file to attach.
 */

import type { InputRecording } from '#lib';

export const NEW_BUG_URL = 'https://github.com/voithos-labs/aragonite/issues/new';

// Measured: GitHub answers 414 past about 8,200 characters, and a signed-out visitor's login
// redirect carries the whole URL again, which fails from about 7,000.
export const MAX_URL_LENGTH = 6000;
// An issue body holds 65,536 characters; the rest of the form needs some of them.
export const MAX_BODY_RECORDING = 60_000;

export interface BugReport {
	url: string;
	/** Where the recording went when it didn't fit in the URL. */
	carrier: 'url' | 'clipboard' | 'download';
	/** The fenced recording, for the clipboard or the downloaded file. */
	fenced: string;
}

export function bugReport(recording: InputRecording, where: string): BugReport {
	const json = JSON.stringify(recording);
	const fenced = '```json\n' + json + '\n```';
	const link = (field: string) =>
		`${NEW_BUG_URL}?${new URLSearchParams({ template: 'bug.yml', where, recording: field })}`;
	const inline = link(fenced);
	if (inline.length <= MAX_URL_LENGTH) return { url: inline, carrier: 'url', fenced };
	if (fenced.length <= MAX_BODY_RECORDING) {
		return {
			url: link('The recording is on your clipboard: paste it here.'),
			carrier: 'clipboard',
			fenced
		};
	}
	return {
		url: link('The recording downloaded as a .json file: drag it into this box.'),
		carrier: 'download',
		fenced: json
	};
}

/** "0.11.1, Chrome 141 on Windows, live mode": what the form's `where` field asks for. */
export function describeWhere(
	version: string,
	userAgent: string,
	platform: string | undefined,
	mode: string
): string {
	return `${version}, ${browserOf(userAgent)} on ${platform || osOf(userAgent)}, ${mode} mode`;
}

function browserOf(ua: string): string {
	const named = [
		['Edge', /Edg\/(\d+)/],
		['Firefox', /Firefox\/(\d+)/],
		['Chrome', /Chrome\/(\d+)/],
		['Safari', /Version\/(\d+(?:\.\d+)?).*Safari/]
	] as const;
	for (const [name, re] of named) {
		const version = re.exec(ua)?.[1];
		if (version) return `${name} ${version}`;
	}
	return 'an unknown browser';
}

function osOf(ua: string): string {
	if (/Android/.test(ua)) return 'Android';
	if (/iPhone|iPad/.test(ua)) return 'iOS';
	if (/Windows/.test(ua)) return 'Windows';
	if (/Mac OS X/.test(ua)) return 'macOS';
	if (/Linux/.test(ua)) return 'Linux';
	return 'an unknown OS';
}
