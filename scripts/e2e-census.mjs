#!/usr/bin/env node
// Fails a CI run in which an engine's shards together ran fewer tests than the tree lists.
// `node scripts/e2e-census.mjs <dir>` reads every `ci-summary.json` under <dir> (one artifact per
// shard); a run that uploaded none, a docs-only push, has nothing to count and passes.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ listTotal: number, groupTotal: number, tests: number, groups: string[], shard: string }} Plan
 * @typedef {{ engine: string, shard: string, counts: Record<string, number>, plan: Plan | null }} Summary
 */

/** @param {Record<string, number>} counts */
const ran = (counts) => counts.passed + counts.failed + counts.flaky + counts.skipped;

/**
 * Every problem with one run's shard summaries: a shard missing, doubled or without a plan, a
 * shard that ran other than its planned tests, and groups lost or run twice across shards.
 * @param {Summary[]} summaries @returns {string[]}
 */
export function censusProblems(summaries) {
	const problems = [];
	/** @type {Map<string, Summary[]>} */
	const byEngine = new Map();
	for (const summary of summaries) {
		byEngine.set(summary.engine, [...(byEngine.get(summary.engine) ?? []), summary]);
	}
	for (const [engine, shards] of byEngine) {
		const plans = shards.map((s) => s.plan);
		if (plans.some((plan) => plan === null)) {
			problems.push(`${engine}: a shard has no plan, so it ran outside scripts/e2e-shards.mjs`);
			continue;
		}
		const total = Number(/** @type {Plan} */ (plans[0]).shard.split('/')[1]);
		const seen = new Set(plans.map((plan) => /** @type {Plan} */ (plan).shard));
		for (let i = 1; i <= total; i++) {
			if (!seen.has(`${i}/${total}`))
				problems.push(`${engine}: shard ${i}/${total} reported nothing`);
		}
		if (seen.size !== shards.length) problems.push(`${engine}: a shard reported twice`);
		const listTotals = new Set(plans.map((plan) => /** @type {Plan} */ (plan).listTotal));
		if (listTotals.size !== 1)
			problems.push(
				`${engine}: shards listed different trees (${[...listTotals].join(', ')} tests)`
			);
		for (const shard of shards) {
			const plan = /** @type {Plan} */ (shard.plan);
			if (ran(shard.counts) !== plan.tests) {
				problems.push(
					`${engine} ${plan.shard}: ran ${ran(shard.counts)} tests of the ${plan.tests} planned`
				);
			}
		}
		const groups = plans.flatMap((plan) => /** @type {Plan} */ (plan).groups);
		const unique = new Set(groups);
		if (unique.size !== groups.length)
			problems.push(`${engine}: ${groups.length - unique.size} spec file(s) ran in two shards`);
		const plan = /** @type {Plan} */ (plans[0]);
		if (unique.size !== plan.groupTotal) {
			problems.push(
				`${engine}: shards planned ${unique.size} of the ${plan.groupTotal} spec files listed`
			);
		}
		const planned = plans.reduce((sum, p) => sum + /** @type {Plan} */ (p).tests, 0);
		if (planned !== plan.listTotal)
			problems.push(`${engine}: shards planned ${planned} of the ${plan.listTotal} tests listed`);
	}
	return problems;
}

/** @param {string} dir @returns {Summary[]} */
function readSummaries(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((file) => path.basename(file) === 'ci-summary.json')
		.map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const summaries = readSummaries(process.argv[2] ?? '');
	const problems = censusProblems(summaries);
	for (const problem of problems) console.error(problem);
	const engines = [...new Set(summaries.map((s) => s.engine))];
	console.log(
		summaries.length === 0
			? 'no e2e ran'
			: `census of ${engines.join(', ')}: ${problems.length} problem(s)`
	);
	process.exit(problems.length === 0 ? 0 : 1);
}
