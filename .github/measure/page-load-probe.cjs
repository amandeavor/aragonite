// Temporary measurement for the ci/test-speed lane: navigation phases per engine and server.
const pw = require('@playwright/test');
const [engine, base, n] = [process.argv[2], process.argv[3], Number(process.argv[4] ?? 10)];
(async () => {
	const browser = await pw[engine].launch(
		engine === 'firefox' ? { channel: 'moz-firefox', executablePath: process.env.FIREFOX_PATH } : {}
	);
	const rows = [];
	for (let i = 0; i < n; i++) {
		const a = Date.now();
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const page = await ctx.newPage();
		let requests = 0;
		page.on('request', () => requests++);
		const b = Date.now();
		await page.goto(`${base}/test/editor`, { waitUntil: 'commit' });
		const c = Date.now();
		await page.waitForLoadState('load');
		const d = Date.now();
		await page.waitForFunction(() => window.__test && window.__parityDocuments, null, { polling: 50 });
		const e = Date.now();
		await ctx.close();
		rows.push({ ctx: b - a, commit: c - b, load: d - c, ready: e - d, total: e - b, requests });
	}
	await browser.close();
	const med = (k) => rows.map((r) => r[k]).sort((x, y) => x - y)[rows.length >> 1];
	const line = `${engine} ${base}: median total ${med('total')} ms (commit ${med('commit')}, load ${med('load')}, ready ${med('ready')}, ctx ${med('ctx')}), requests ${rows[0].requests}; totals ${rows.map((r) => r.total).join(',')}`;
	console.log(line);
	require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY ?? '/dev/null', `- ${line}\n`);
})();
