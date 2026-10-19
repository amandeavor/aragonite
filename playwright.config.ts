import { defineConfig, type Project } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };
const PROD = !!process.env.PERF_PROD;
const ENGINE = process.env.ENGINE ?? 'chromium';
// A run that adopts a developer's live harness on the default port serves whatever that
// tree currently is, so a reviewer's battery moves both servers and reuses neither.
// `E2E_PORT` picks the isolated server's port, so two isolated batteries on one machine (two
// worktrees, say) never race for 1430; it implies isolation.
const OWN_PORT = Number(process.env.E2E_PORT) || 0;
const ISOLATED = !!process.env.E2E_ISOLATED || OWN_PORT > 0;
const DEV_PORT = OWN_PORT || (ISOLATED ? 1430 : 1420);
const PROD_PORT = OWN_PORT ? OWN_PORT + 1 : ISOLATED ? 1431 : 1421;

// `stdout: 'pipe'` routes the server's console through the reporters, which is what lets
// `server-warn-reporter` fail a run on an SSR-side `[aragonite:` guard fire. Stderr already pipes.
const devServer = {
	// `vite.config.js` pins the default port with `strictPort`, so isolation must move it on
	// the command line; Playwright's `url` only says where to wait.
	command: ISOLATED ? `npm run dev -- --port ${DEV_PORT} --strictPort` : 'npm run dev',
	// Waits for the harness page: Vite opens and closes the port while checking it is free,
	// before it serves, so a port check can pass early and the first page load is refused.
	url: `http://localhost:${DEV_PORT}/test/editor`,
	reuseExistingServer: !ISOLATED,
	stdout: 'pipe' as const,
	// Covers the first compile of the harness page, which has taken about 40s on a loaded machine.
	timeout: 60_000
};

const prodServer = {
	command: `npm run build && npm run preview -- --port ${PROD_PORT} --strictPort`,
	// Waits for a page, not the port, for the same reason as the dev server.
	url: `http://localhost:${PROD_PORT}/test/editor`,
	reuseExistingServer: !ISOLATED,
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
		launchOptions: process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {},
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
	use: {
		baseURL: `http://localhost:${DEV_PORT}`,
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
	webServer: PROD ? [devServer, prodServer] : devServer,
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
			// Each session is independent and the asserted artifact is the timing-independent
			// source, so scheduling cannot change an assertion. Capped: one browser per worker.
			fullyParallel: true,
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
						use: {
							viewport: { width: 1280, height: 900 },
							baseURL: `http://localhost:${PROD_PORT}`
						}
					}
				]
			: [])
	].filter((project) => ENGINE === 'chromium' || !CHROMIUM_ONLY.has(project.name))
});
