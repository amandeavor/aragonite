// Whether the process is a Vitest run, read by both builds of `dev-checks`.

declare const process: { env?: Record<string, string | undefined> } | undefined;

export function detectTestProcess(): boolean {
	return typeof process !== 'undefined' && !!process?.env?.VITEST;
}
