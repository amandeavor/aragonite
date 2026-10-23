import { defineConfig, type Project } from '@playwright/test';
import { resolveSelfImportsFromSource } from './scripts/lib-alias.mjs';

resolveSelfImportsFromSource();

declare const process: { env: Record<string, string | undefined> };
const PROD = !!process.env.PERF_PROD;
const ENGINE = process.env.ENGINE ?? 'chromium';
// The suite serves a development build of the tree as the run starts (dev checks on, no
// on-demand transforms), never reused, since a reused build is staler than any dev server.
// `E2E_SERVER=dev` serves the Vite dev server instead, for UI and watch mode's live reload; it
// adopts a dev server already on 1420 unless `E2E_PORT` asks for its own. `E2E_PORT` moves the
// run's server (the perf gate's preview takes the next port), so two runs never share one.
const BUILT = process.env.E2E_SERVER !== 'dev';
const OWN_PORT = Number(process.env.E2E_PORT) || 0;
const REUSE = !BUILT && OWN_PORT === 0;
const APP_PORT = OWN_PORT || (BUILT ? 1430 : 1420);
const PROD_PORT = APP_PORT + 1;
// IPv4 loopback: on Windows, Firefox tries 127.0.0.1 for `localhost` first and a refused
// connection there costs 2 s per navigation.
const HOST = '127.0.0.1';
// A dev server someone started listens on `localhost`, which on Windows is IPv6 only.
const APP_ORIGIN = `http://${REUSE ? 'localhost' : HOST}:${APP_PORT}`;

// `stdout: 'pipe'` routes the server's console through the reporters, which is what lets
// `server-warn-reporter` fail a run on an SSR-side `[aragonite:` guard fire. Stderr already pipes.
const appServer = BUILT
	? {
			// Its own output directory per port, so two runs and the perf gate's prod build never
			// overwrite the app another run is serving.
			command: `npm run build:e2e && npm run preview:e2e -- --host ${HOST} --port ${APP_PORT} --strictPort`,
			env: { E2E_BUILD_DIR: `.svelte-kit/e2e-${APP_PORT}` },
			url: `${APP_ORIGIN}/test/editor`,
			reuseExistingServer: false,
			stdout: 'pipe' as const,
			timeout: 120_000
		}
	: {
			// `vite.config.js` pins the default port with `strictPort`, so a run's own server must
			// move it on the command line; Playwright's `url` only says where to wait.
			command: REUSE
				? 'npm run dev'
				: `npm run dev -- --host ${HOST} --port ${APP_PORT} --strictPort`,
			// Waits for the harness page: Vite opens and closes the port while checking it is free,
			// before it serves, so a port check can pass early and the first page load is refused.
			url: `${APP_ORIGIN}/test/editor`,
			reuseExistingServer: REUSE,
			stdout: 'pipe' as const,
			// Covers the first compile of the harness page, which has taken about 40s on a loaded machine.
			timeout: 60_000
		};

const prodServer = {
	command: `npm run build && npm run preview -- --port ${PROD_PORT} --strictPort`,
	// Waits for a page, not the port, for the same reason as the app server.
	url: `http://localhost:${PROD_PORT}/test/editor`,
	reuseExistingServer: REUSE,
	stdout: 'pipe' as const,
	timeout: 180_000
};

// Each dir gets its own `e2e-<dir>` project, and e2e-top ignores all of them so its specs never
// double-run. The projects carrying custom config stay hand-written below, their dirs ignored
// by hand.
const PROJECT_DIRS = [
	'blocks',
	'decorations',
	'plugins',
	'presentation',
	'selection',
	'sticky-column',
	'a11y',
	'search',
	'clipboard',
	'recordings'
];

// The browser every project runs in. Firefox is the installed release over WebDriver BiDi, not
// Playwright's patched build; `FIREFOX_PATH` points at one outside the system path. WebKit throws
// on the clipboard permissions, and the clipboard arm gives both engines an in-page store instead.
const ENGINES: Record<string, Project['use']> = {
	chromium: { browserName: 'chromium', permissions: ['clipboard-read', 'clipboard-write'] },
	firefox: {
		browserName: 'firefox',
		channel: 'moz-firefox',
		launchOptions: {
			executablePath: process.env.FIREFOX_PATH,
			// Headless Firefox on a Linux runner finds no pointing device, so `(pointer: fine)` and
			// `(hover: hover)` stop matching; these give it the desktop mouse it has elsewhere.
			firefoxUserPrefs: { 'ui.primaryPointerCapabilities': 6, 'ui.allPointerCapabilities': 6 }
		},
		permissions: []
	},
	webkit: { browserName: 'webkit', permissions: [] }
};
const engine = ENGINES[ENGINE];
if (!engine)
	throw new Error(`ENGINE=${ENGINE}: expected one of ${Object.keys(ENGINES).join(', ')}`);
// The perf ceilings are calibrated in Chromium and the docs captures are taken there, so the
// other engines run the correctness projects only.
const CHROMIUM_ONLY = new Set(['e2e-capture', 'e2e-perf', 'e2e-perf-prod']);

export default defineConfig({
	testDir: './src/lib/e2e/tests',
	// A hang guard, not a budget: a first navigation onto a heavy route can outrun 30s under
	// many-worker contention on slower hosts, and a real hang still fails at 60.
	timeout: 60_000,
	retries: 0,
	// The test, not the file, is what a worker and a shard take, so no long file holds a worker
	// after the rest have finished.
	fullyParallel: true,
	use: {
		baseURL: APP_ORIGIN,
		headless: true,
		...engine,
		// Pinned, not inherited: specs across several projects assert near-absolute geometry and
		// would turn red the day Playwright's implicit default moves. Projects may override.
		viewport: { width: 1280, height: 720 }
	},
	// Playwright's default reporter, the server-warning watcher, and in a GitHub job its summary.
	reporter: [
		[process.env.CI ? 'dot' : 'list'],
		['./src/lib/e2e/server-warn-reporter.ts'],
		...(process.env.GITHUB_STEP_SUMMARY ? [['./src/lib/e2e/ci-summary-reporter.ts'] as const] : [])
	],
	webServer: PROD ? [appServer, prodServer] : appServer,
	projects: [
		{
			name: 'e2e-top',
			testMatch: '*.spec.ts',
			testIgnore: [
				...PROJECT_DIRS.map((dir) => `${dir}/**`),
				'simulation/**',
				'perf/**',
				'capture/**'
			]
		},
		{
			// Docs-asset capture, not a test: env-gated, and it writes into docs/assets.
			name: 'e2e-capture',
			testMatch: 'capture/**/*.spec.ts',
			use: { viewport: { width: 620, height: 900 }, deviceScaleFactor: 2 }
		},
		{
			name: 'e2e-simulation',
			testMatch: 'simulation/**/*.spec.ts',
			timeout: 180_000,
			// Capped: each session drives a long note, one browser per worker.
			workers: 4,
			// The editor scrolls internally, so a short viewport clips a long note's trailing
			// blocks out of the capture screenshots; fixed, so pixel geometry stays deterministic.
			use: { viewport: { width: 1280, height: 1500 } }
		},
		{
			// Latency rows on 10MB fixtures spend minutes in load + per-keystroke
			// settles; the generous timeout is the budget for one full row.
			name: 'e2e-perf',
			testMatch: 'perf/**/*.perf.spec.ts',
			timeout: 600_000,
			// Timed rows: a file's rows run one after another, so a row never measures beside its siblings.
			fullyParallel: false,
			use: { viewport: { width: 1280, height: 900 } }
		},
		{
			// VR correctness, not perf: `vr-*.spec.ts` under `perf/` rides the default `npm test`
			// battery while `*.perf.spec.ts` stays env-gated — the glob partition G4.17 guards.
			name: 'e2e-vr',
			testMatch: 'perf/vr-*.spec.ts',
			timeout: 120_000,
			use: { viewport: { width: 1280, height: 900 } }
		},
		...PROJECT_DIRS.map((dir) => ({ name: `e2e-${dir}`, testMatch: `${dir}/**/*.spec.ts` })),
		...(PROD
			? [
					{
						name: 'e2e-perf-prod',
						testMatch: 'perf/**/*.perf.spec.ts',
						timeout: 600_000,
						fullyParallel: false,
						use: {
							viewport: { width: 1280, height: 900 },
							baseURL: `http://localhost:${PROD_PORT}`
						}
					}
				]
			: [])
	].filter((project) => ENGINE === 'chromium' || !CHROMIUM_ONLY.has(project.name))
});
