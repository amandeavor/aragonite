/**
 * The panel's input recording controls: record, stop, then send the file to the dev server
 * (`src/routes/test/recordings`) or download it. Send falls back to a download wherever the dev
 * route isn't there, which is any build, the deployed demo included.
 */

import type { Editor } from '#lib/svelte.js';
import type { InputRecording, InputRecordingHandle } from '#lib';

type EditorInstance = ReturnType<typeof Editor>;

export const RECORDINGS_ROUTE = '/test/recordings';

export function createPanelRecorder(getEditor: () => EditorInstance | undefined) {
	let handle: InputRecordingHandle | null = $state.raw(null);
	let last: InputRecording | null = $state.raw(null);
	let status = $state('');

	function download(recording: InputRecording): void {
		const blob = new Blob([JSON.stringify(recording, null, '\t')], { type: 'application/json' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `aragonite-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	return {
		get recording() {
			return handle !== null;
		},
		get last() {
			return last;
		},
		get status() {
			return status;
		},
		start(includeText: boolean) {
			const diagnostics = getEditor()?.getDiagnostics();
			if (!diagnostics) return;
			handle = diagnostics.recordInput({ includeText });
			last = null;
			status = '';
		},
		stop() {
			last = handle?.stop() ?? null;
			handle = null;
		},
		async send() {
			if (!last) return;
			const response = await fetch(RECORDINGS_ROUTE, {
				method: 'POST',
				body: JSON.stringify(last)
			}).catch(() => null);
			if (response?.ok) {
				status = `saved to ${((await response.json()) as { saved: string }).saved}`;
				return;
			}
			download(last);
			status = `the dev server didn't take it (${response ? `HTTP ${response.status}` : 'offline'}), so it downloaded instead`;
		},
		download() {
			if (last) download(last);
		}
	};
}
