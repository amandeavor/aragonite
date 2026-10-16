// jsdom has no clipboard events, no `DataTransfer` and no `execCommand`. These stand in for all
// three, so a unit test drives a menu's clipboard rows through the events a browser fires.

import { vi } from 'vitest';

class StubDataTransfer {
	readonly files: File[] = [];
	readonly items: DataTransferItem[] = [];
	private readonly data = new Map<string, string>();
	setData(type: string, value: string): void {
		this.data.set(type, value);
	}
	getData(type: string): string {
		return this.data.get(type) ?? '';
	}
}

class StubClipboardEvent extends Event {
	readonly clipboardData: StubDataTransfer | null;
	constructor(type: string, init: EventInit & { clipboardData?: StubDataTransfer } = {}) {
		super(type, init);
		this.clipboardData = init.clipboardData ?? null;
	}
}

/** Installs the stand-ins; `written()` is the plain text the last cut or copy put on the clipboard. */
export function installClipboardEvents(): { written: () => string } {
	vi.stubGlobal('DataTransfer', StubDataTransfer);
	vi.stubGlobal('ClipboardEvent', StubClipboardEvent);
	let last = new StubDataTransfer();
	document.execCommand = vi.fn((command: string) => {
		if (command !== 'cut' && command !== 'copy') return false;
		last = new StubDataTransfer();
		const event = new StubClipboardEvent(command, {
			clipboardData: last,
			bubbles: true,
			cancelable: true
		});
		document.activeElement?.dispatchEvent(event);
		return true;
	});
	return { written: () => last.getData('text/plain') };
}
