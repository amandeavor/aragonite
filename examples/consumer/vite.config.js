import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const require = createRequire(import.meta.url);
const libraryManifest = require.resolve('@voithos-labs/aragonite/package.json');
/** @type {Record<string, string | { svelte?: string }>} */
const libraryExports = JSON.parse(readFileSync(libraryManifest, 'utf8')).exports;
// The files this app's bundler loads, through the `svelte` condition; resolving the package from
// Node here would pick `default`, the prebuilt build a Svelte app never loads.
const libraryEntries = new Set(
	Object.values(libraryExports)
		.flatMap((target) => (typeof target === 'object' && target.svelte ? [target.svelte] : []))
		.map((entry) => path.resolve(path.dirname(libraryManifest), entry))
);

export default defineConfig({
	plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })],
	build: {
		rolldownOptions: {
			checks: { circularDependency: true },
			// A published entry inside an import cycle can run before its own imports once the
			// bundle splits it across chunks, so that cycle fails the build; other cycles are noise.
			onLog(level, log, handler) {
				if (log.code !== 'CIRCULAR_DEPENDENCY') return handler(level, log);
				if (log.ids?.some((id) => libraryEntries.has(path.resolve(id))))
					throw new Error(log.message);
			}
		}
	}
});
