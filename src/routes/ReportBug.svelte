<script lang="ts">
	/**
	 * The showcase header's "report a bug" button: asks first, records the visitor's input with
	 * text, then on Stop opens GitHub's prefilled bug form in a new tab. It never files anything;
	 * the visitor reads the form and submits it themselves.
	 */
	import type { EditorInstance, InputRecording, InputRecordingHandle } from '#lib';
	import { ARAGONITE_VERSION } from '#lib/version.js';
	import { bugReport, describeWhere } from './bug-report';

	let { editor, mode }: { editor: EditorInstance | undefined; mode: string } = $props();

	let phase = $state<'idle' | 'asking' | 'recording' | 'sent'>('idle');
	let carrier = $state<'clipboard' | 'download'>('clipboard');
	let copyFailed = $state(false);
	let attachment = '';
	let handle: InputRecordingHandle | null = null;

	function start() {
		handle = editor?.getDiagnostics().recordInput({ includeText: true }) ?? null;
		phase = handle ? 'recording' : 'idle';
	}

	// The tab opens in the click's own turn: Safari drops a window.open made after an await.
	function stop() {
		const recording = handle?.stop();
		handle = null;
		if (!recording) return;
		const nav = navigator as Navigator & { userAgentData?: { platform: string } };
		const where = describeWhere(
			ARAGONITE_VERSION,
			nav.userAgent,
			nav.userAgentData?.platform,
			mode
		);
		const report = bugReport(recording, where);
		carrier = report.carrier;
		attachment = report.attachment;
		copyFailed = false;
		if (report.carrier === 'clipboard') copy();
		if (report.carrier === 'download') download(recording, report.attachment);
		window.open(report.url, '_blank', 'noopener');
		phase = 'sent';
	}

	// A copy refused as the new tab took focus works from a click of its own on this page.
	function copy() {
		navigator.clipboard.writeText(attachment).then(
			() => (copyFailed = false),
			() => (copyFailed = true)
		);
	}

	function download(recording: InputRecording, json: string) {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		link.download = `aragonite-recording-${recording.steps.length}-steps.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

{#if phase === 'recording'}
	<button
		type="button"
		class="showcase-toggle active report-btn"
		data-testid="report-bug"
		onclick={stop}
	>
		<span class="report-dot" aria-hidden="true"></span>stop and report
	</button>
{:else}
	<button
		type="button"
		class="showcase-toggle report-btn"
		data-testid="report-bug"
		aria-expanded={phase === 'asking'}
		onclick={() => (phase = phase === 'asking' ? 'idle' : 'asking')}
	>
		report a bug
	</button>
{/if}

{#if phase === 'asking'}
	<div class="report-card" role="dialog" aria-label="Report a bug" data-testid="report-card">
		<p>
			Press start, do the thing that broke, then press stop. GitHub opens a new bug report in
			another tab, and a recording of what you did goes on your clipboard to paste into it.
		</p>
		<p>
			<strong>The recording includes everything you type and the whole document's text</strong>, and
			an issue you submit is public. Nothing reaches GitHub until you paste it and submit.
		</p>
		<div class="report-actions">
			<button type="button" class="report-start" onclick={start}>Start recording</button>
			<button type="button" class="report-cancel" onclick={() => (phase = 'idle')}>Cancel</button>
		</div>
	</div>
{:else if phase === 'sent'}
	<div class="report-card" role="status" data-testid="report-card">
		<p>
			{#if carrier === 'clipboard' && !copyFailed}
				GitHub opened in a new tab and the recording is on your clipboard: paste it into the form's
				Recording box, add what happened, and submit.
			{:else if carrier === 'clipboard'}
				GitHub opened in a new tab, but the browser kept the recording off your clipboard. Copy it
				here, then paste it into the form's Recording box.
			{:else}
				GitHub opened in a new tab. The recording was too long for an issue, so it downloaded as a
				file: drag it into the form's Recording box.
			{/if}
		</p>
		<div class="report-actions">
			{#if carrier === 'clipboard' && copyFailed}
				<button type="button" class="report-start" onclick={copy}>Copy recording</button>
			{/if}
			<button type="button" class="report-cancel" onclick={() => (phase = 'idle')}>Close</button>
		</div>
	</div>
{/if}

<style>
	.report-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.report-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--color-error, #d9534f);
	}
	.report-card {
		position: fixed;
		top: 3.25rem;
		right: 1rem;
		z-index: 50;
		width: min(24rem, calc(100vw - 2rem));
		box-sizing: border-box;
		padding: 0.75rem 0.9rem;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--color-text-secondary, #cfcfca);
		background: var(--color-bg-elevated, #353533);
		border: 1px solid var(--color-border, #3e3e3b);
		border-radius: 8px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
	}
	.report-card p {
		margin: 0 0 0.6rem;
	}
	.report-card strong {
		color: var(--color-text-primary, #e8e8e5);
	}
	.report-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.report-start,
	.report-cancel {
		font: inherit;
		padding: 0.25rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid var(--color-border, #3e3e3b);
		color: var(--color-text-primary, #e8e8e5);
		background: transparent;
	}
	.report-start {
		background: var(--color-accent, #567b67);
		border-color: transparent;
		color: #fff;
	}
</style>
