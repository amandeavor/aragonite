/**
 * Holds what a press read at pointerdown until its click takes it. The click comes after the
 * release, so the release alone can't end the record; a release outside the surface, a cancel, or
 * the next press does, so no later click reads a press that wasn't its own.
 */

export interface NotedPress<T> {
	/** Keep `reading` for the click that ends this press on `surface`. */
	note(reading: T, surface: HTMLElement): void;
	/** The press's reading, once: the click calls this, and it returns null after. */
	take(): T | null;
	dispose(): void;
}

export function createNotedPress<T>(): NotedPress<T> {
	let held: T | null = null;
	let unwatch: (() => void) | null = null;

	function clear(): void {
		held = null;
		unwatch?.();
		unwatch = null;
	}

	function watch(surface: HTMLElement): void {
		const onRelease = (e: PointerEvent) => {
			if (!(e.target instanceof Node && surface.contains(e.target))) clear();
		};
		window.addEventListener('pointerup', onRelease, true);
		window.addEventListener('pointercancel', clear, true);
		window.addEventListener('pointerdown', clear, true);
		unwatch = () => {
			window.removeEventListener('pointerup', onRelease, true);
			window.removeEventListener('pointercancel', clear, true);
			window.removeEventListener('pointerdown', clear, true);
		};
	}

	return {
		note(reading, surface) {
			clear();
			held = reading;
			watch(surface);
		},
		take() {
			const reading = held;
			clear();
			return reading;
		},
		dispose: clear
	};
}
