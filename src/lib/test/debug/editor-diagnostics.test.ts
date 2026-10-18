// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createEditorDiagnostics } from '#lib/debug/editor-diagnostics.js';
import { createOperationsLog } from '#lib/debug/operations-log.js';

// Miss-analysis: only the pure report builder had tests; the entry point feeding it needed a mount.

function diagnostics(
	selection: { path: number[]; offset: number } | null,
	root: HTMLElement | null = null
) {
	let sourceReads = 0;
	const log = createOperationsLog();
	log.record({ op: 'split', path: [0], detail: {} });
	const door = createEditorDiagnostics({
		getSelection: () => selection && { anchor: selection, focus: selection },
		getSource: () => {
			sourceReads++;
			return 'SECRET';
		},
		operationsLog: log,
		recorder: {
			root: () => root,
			contentVersion: () => 0,
			presentationMode: () => 'source',
			caret: () => 'auto',
			rawPoint: () => null
		}
	});
	return { door, reads: () => sourceReads };
}

describe('createEditorDiagnostics', () => {
	it('summarizes the public selection snapshot, or its absence', () => {
		expect(diagnostics({ path: [0, 2], offset: 3 }).door.serializeDiagnostics()).toContain(
			'anchor=[0,2]@3 focus=[0,2]@3'
		);
		expect(diagnostics(null).door.serializeDiagnostics()).toContain('(no selection)');
	});

	it('never reads the source unless asked, and includes it when it is', () => {
		const d = diagnostics(null);
		expect(d.door.serializeDiagnostics()).not.toContain('SECRET');
		expect(d.reads()).toBe(0);
		expect(d.door.serializeDiagnostics({ includeSource: true })).toContain('SECRET');
	});

	it('carries the operations log tail', () => {
		expect(diagnostics(null).door.serializeDiagnostics()).toContain('split');
	});

	it('stops a recording still running when the editor goes away', () => {
		const root = document.createElement('div');
		const d = diagnostics(null, root);
		const recording = d.door.recordInput();
		d.door.dispose();
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(recording.stop().steps).toEqual([]);
	});
});
