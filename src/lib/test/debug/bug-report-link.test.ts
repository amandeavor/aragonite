import { describe, it, expect } from 'vitest';
import {
	MAX_BODY_RECORDING,
	MAX_URL_LENGTH,
	bugReport,
	describeWhere
} from '../../../routes/bug-report';
import { INPUT_RECORDING_FORMAT, type InputRecording } from '#lib/debug/input-recording.js';

// Miss-analysis: new module; the e2e row only sees the clipboard branch, since the showcase's own
// document never fits a link.

function recordingOf(source: string): InputRecording {
	return {
		format: INPUT_RECORDING_FORMAT,
		editor: { version: '0.11.1', presentationMode: 'live', caret: 'auto' },
		text: true,
		env: {
			userAgent: '',
			uaData: null,
			pointer: 'fine',
			viewport: [0, 0],
			dpr: 1
		},
		initial: { source, hash: 'h', selection: null },
		steps: [],
		expected: []
	};
}

const recordingField = (url: string) => new URL(url).searchParams.get('recording') ?? '';

describe('bugReport', () => {
	it('fills the bug form, recording fenced, when the link stays short', () => {
		const report = bugReport(recordingOf('hi\n'), '0.11.1, Chrome 141 on Windows, live mode');
		const url = new URL(report.url);
		expect(report.carrier).toBe('url');
		expect(url.origin + url.pathname).toBe('https://github.com/voithos-labs/aragonite/issues/new');
		expect(url.searchParams.get('template')).toBe('bug.yml');
		expect(url.searchParams.get('where')).toBe('0.11.1, Chrome 141 on Windows, live mode');
		expect(JSON.parse(recordingField(report.url).replace(/^```json\n|\n```$/g, ''))).toEqual(
			recordingOf('hi\n')
		);
		expect(report.url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
	});

	it('moves a recording too long for the link onto the clipboard, fenced', () => {
		const report = bugReport(recordingOf('x'.repeat(MAX_URL_LENGTH)), 'w');
		expect(report.carrier).toBe('clipboard');
		expect(report.url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
		expect(recordingField(report.url)).toContain('on your clipboard');
		expect(report.attachment.startsWith('```json\n{')).toBe(true);
	});

	it('downloads one too long for an issue body', () => {
		const report = bugReport(recordingOf('x'.repeat(MAX_BODY_RECORDING)), 'w');
		expect(report.carrier).toBe('download');
		expect(recordingField(report.url)).toContain('drag it into this box');
		expect(JSON.parse(report.attachment).format).toBe(INPUT_RECORDING_FORMAT);
	});
});

describe('describeWhere', () => {
	it.each([
		[
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
			undefined,
			'0.11.1, Edge 141 on Windows, source mode'
		],
		[
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
			undefined,
			'0.11.1, Safari 18.2 on macOS, source mode'
		],
		[
			'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
			undefined,
			'0.11.1, Firefox 145 on Linux, source mode'
		],
		[
			'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
			'Android',
			'0.11.1, Chrome 141 on Android, source mode'
		]
	])('names %s', (ua, platform, where) => {
		expect(describeWhere('0.11.1', ua, platform, 'source')).toBe(where);
	});
});
