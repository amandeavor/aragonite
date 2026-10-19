/**
 * The required status-check contexts in `scripts/apply-branch-protection.mjs` match what the
 * workflows report: ci.yml's gating job ids (a `continue-on-error` job reports without gating),
 * matrix jobs expanded the way GitHub names them, and each declared external against the workflow
 * reporting it. A context nothing reports leaves every PR waiting forever.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectFiles, literalSpans, stripComments } from './scan-source';

const WORKFLOWS = '.github/workflows';
const CI = 'ci.yml';
const SCRIPT = path.resolve('scripts/apply-branch-protection.mjs');

// ── ci.yml ───────────────────────────────────────────────────────────────────

const JOB_ID = /^ {2}([A-Za-z0-9_-]+):\s*$/;
const JOB_NAME = /^ {4}name:\s*(.+?)\s*$/;
const MATRIX_DIMENSION = /^ {8}([A-Za-z0-9_-]+):\s*\[(.+)\]\s*$/;
const MATRIX_KEYS_UNPARSED = /^ {8}(include|exclude):/;
const CONTINUE_ON_ERROR = /^ {4}continue-on-error:\s*(.+?)\s*$/;
const JOB_IF = /^ {4}if:/;

/** The `jobs:` mapping's own lines, ending at the next top-level key. */
function jobsBlock(yaml: string): string[] {
	const lines = yaml.split('\n');
	const start = lines.findIndex((line) => line === 'jobs:');
	if (start === -1) return [];
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => /^[^\s#]/.test(line));
	return end === -1 ? rest : rest.slice(0, end);
}

function flowSequence(raw: string): string[] {
	return raw
		.split(',')
		.map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter((item) => item !== '');
}

/**
 * GitHub names a matrix check `<job> (<v1>, <v2>)`, one value per dimension in declaration
 * order, so the contexts a run reports are the product of the inline sequences.
 */
function expand(label: string, dimensions: string[][]): string[] {
	if (dimensions.length === 0) return [label];
	let combinations: string[][] = [[]];
	for (const values of dimensions) {
		combinations = combinations.flatMap((prefix) => values.map((value) => [...prefix, value]));
	}
	return combinations.map((values) => `${label} (${values.join(', ')})`);
}

interface JobChecks {
	names: string[];
	/** False for a `continue-on-error` job, whose red never fails the run. */
	gates: boolean;
	/** A matrix job with a job-level `if:`, which reports one bare check when skipped. */
	skipsWholeMatrix: boolean;
}

/** Each job's check names, matrix jobs expanded. */
function readJobs(yaml: string): JobChecks[] {
	const jobs: JobChecks[] = [];
	let label: string | null = null;
	let dimensions: string[][] = [];
	let gates = true;
	let conditional = false;
	const flush = () => {
		if (label === null) return;
		const skipsWholeMatrix = conditional && dimensions.length > 0;
		jobs.push({ names: expand(label, dimensions), gates, skipsWholeMatrix });
	};
	for (const line of jobsBlock(yaml)) {
		const job = JOB_ID.exec(line);
		if (job) {
			flush();
			label = job[1];
			dimensions = [];
			gates = true;
			conditional = false;
			continue;
		}
		if (label === null) continue;
		if (JOB_IF.test(line)) conditional = true;
		const continues = CONTINUE_ON_ERROR.exec(line);
		if (continues) {
			if (continues[1] !== 'true' && continues[1] !== 'false') {
				throw new Error(
					`continue-on-error in job "${label}": this reader reads true or false only`
				);
			}
			gates = continues[1] === 'false';
		}
		const name = JOB_NAME.exec(line);
		if (name) label = name[1].replace(/^['"]|['"]$/g, '');
		if (MATRIX_KEYS_UNPARSED.test(line)) {
			throw new Error(`${line.trim()} in job "${label}": this reader expands inline lists only`);
		}
		const dimension = MATRIX_DIMENSION.exec(line);
		if (dimension) dimensions.push(flowSequence(dimension[2]));
	}
	flush();
	return jobs;
}

/** Every check name the workflow reports. */
export function checkNames(yaml: string): string[] {
	return readJobs(yaml).flatMap((job) => job.names);
}

/** Gating matrix jobs a job-level `if:` can skip whole, leaving their shard checks unreported. */
export function unreportableGates(yaml: string): string[] {
	return readJobs(yaml)
		.filter((job) => job.gates && job.skipsWholeMatrix)
		.map((job) => job.names[0]);
}

/** The check names whose red fails the run, the only ones a protection rule can require. */
export function gatingCheckNames(yaml: string): string[] {
	return readJobs(yaml)
		.filter((job) => job.gates)
		.flatMap((job) => job.names);
}

// ── The protection rule ──────────────────────────────────────────────────────

/** Single-quoted strings in a slice of the script, comments skipped. */
function quotedStrings(source: string): string[] {
	const code = stripComments(source, 'script');
	return literalSpans(code)
		.filter((span) => code[span.start] === "'")
		.map((span) => code.slice(span.start + 1, span.end - 1));
}

/** The `CI_CONTEXTS` array: the half of the rule ci.yml itself reports. */
export function ciContexts(script: string): string[] {
	const array = /const CI_CONTEXTS = \[([^\]]*)\]/.exec(script);
	if (array === null) throw new Error('apply-branch-protection.mjs declares no CI_CONTEXTS array');
	return quotedStrings(array[1]);
}

/** The `EXTERNAL_CONTEXTS` map: workflow file → the checks it is trusted to report. */
export function externalContexts(script: string): Map<string, string[]> {
	const block = /const EXTERNAL_CONTEXTS = \{([\s\S]*?)\};/.exec(script);
	if (block === null) {
		throw new Error('apply-branch-protection.mjs declares no EXTERNAL_CONTEXTS map');
	}
	const declared = new Map<string, string[]>();
	for (const line of stripComments(block[1], 'script').split('\n')) {
		const entry = /^\s*'([^']+)':\s*\[([^\]]*)\]/.exec(line);
		if (entry !== null) declared.set(entry[1], quotedStrings(entry[2]));
	}
	return declared;
}

/** Declared externals the named workflow does not report: a missing file, a renamed job. */
export function unreportedExternals(
	declared: Map<string, string[]>,
	reported: Map<string, string[]>
): string[] {
	const hits: string[] = [];
	for (const [file, names] of declared) {
		const actual = reported.get(file);
		if (actual === undefined) {
			hits.push(`${file}: no such workflow`);
			continue;
		}
		for (const name of names) if (!actual.includes(name)) hits.push(`${file}: ${name}`);
	}
	return hits;
}

/** Required checks a workflow reports without being declared as that check's reporter. */
export function undeclaredReporters(
	required: string[],
	declared: Map<string, string[]>,
	reported: Map<string, string[]>
): string[] {
	const hits: string[] = [];
	for (const [file, names] of reported) {
		for (const name of names) {
			if (!required.includes(name)) continue;
			if (declared.get(file)?.includes(name)) continue;
			hits.push(`${file}: ${name}`);
		}
	}
	return hits;
}

const workflowChecks = new Map(
	collectFiles(WORKFLOWS, { extensions: ['.yml'] }).map((file): [string, string[]] => [
		path.basename(file),
		checkNames(readFileSync(file, 'utf8'))
	])
);
const ci = workflowChecks.get(CI) ?? [];
const ciGating = gatingCheckNames(readFileSync(path.join(WORKFLOWS, CI), 'utf8'));
const script = readFileSync(SCRIPT, 'utf8');
const declaredCi = ciContexts(script);
const declaredExternal = externalContexts(script);
const required = [...declaredCi, ...[...declaredExternal.values()].flat()];

// ── The gate ─────────────────────────────────────────────────────────────────

describe('branch protection ↔ workflow check names', () => {
	it('requires exactly the checks ci.yml gates on', () => {
		expect(
			[...declaredCi].sort(),
			`CI_CONTEXTS in ${path.basename(SCRIPT)} and ${CI}'s gating job names have diverged: a context ci.yml never reports blocks every PR forever, a gating job with no context protects nothing, and a continue-on-error job never gates`
		).toEqual([...ciGating].sort());
	});

	it('every declared external is reported by the workflow named for it', () => {
		const unreported = unreportedExternals(declaredExternal, workflowChecks);
		expect(
			unreported,
			`EXTERNAL_CONTEXTS names a check its workflow never reports, which blocks every PR forever: ${unreported.join(', ')}`
		).toEqual([]);
		expect(
			[...declaredExternal.values()].flat().filter((name) => ci.includes(name)),
			'a name declared external that ci.yml also reports would be required twice, satisfiable from either side'
		).toEqual([]);
	});

	it('sends both halves in the payload it applies', () => {
		const contexts = /contexts:\s*(.+)$/m.exec(script)?.[1] ?? '';
		expect(
			contexts,
			'the readers below hold two declarations the payload has stopped spreading, so a half of the rule would silently go unrequired'
		).toContain('CI_CONTEXTS');
		expect(contexts).toContain('EXTERNAL_CONTEXTS');
	});

	it('no gating matrix job can be skipped whole', () => {
		const ciYaml = readFileSync(path.join(WORKFLOWS, CI), 'utf8');
		expect(
			unreportableGates(ciYaml),
			'a matrix job skipped by a job-level if reports one check under its bare name, so its required per-shard checks never arrive; condition its steps instead'
		).toEqual([]);
	});

	it('no undeclared workflow reports a check name the rule requires', () => {
		const outsideCi = new Map([...workflowChecks].filter(([file]) => file !== CI));
		const colliding = undeclaredReporters(required, declaredExternal, outsideCi);
		expect(
			colliding,
			`a second workflow reporting a required check satisfies the rule from outside the PR entry point: ${colliding.join(', ')}`
		).toEqual([]);
	});
});

// ── Non-vacuity self-tests ───────────────────────────────────────────────────
// A reader that parses nothing would pass both directions above on two empty sets.

describe('branch-protection context readers: self-tests', () => {
	it('finds the real job set, matrix shards expanded', () => {
		expect(ci.length).toBeGreaterThan(4);
		expect(ci).toContain('unit');
		expect(ci.filter((name) => name.startsWith('e2e '))).toHaveLength(4);
		expect(declaredCi.length).toBe(ciGating.length);
		expect(ci.length).toBeGreaterThan(ciGating.length);
		expect([...declaredExternal.keys()]).toEqual([]);
	});

	it('reports a continue-on-error job without counting it as gating', () => {
		const yaml = [
			'jobs:',
			'  unit:',
			'    runs-on: ubuntu-latest',
			'  engine:',
			'    continue-on-error: true',
			'    strategy:',
			'      matrix:',
			"        shard: ['1/2', '2/2']",
			'  pinned:',
			'    continue-on-error: false'
		].join('\n');
		expect(checkNames(yaml)).toEqual(['unit', 'engine (1/2)', 'engine (2/2)', 'pinned']);
		expect(gatingCheckNames(yaml)).toEqual(['unit', 'pinned']);
		expect(unreportableGates(yaml)).toEqual([]);
		const skipped = [
			'jobs:',
			'  e2e:',
			'    if: false',
			'    strategy:',
			'      matrix:',
			'        shard: [1, 2]'
		];
		expect(unreportableGates(skipped.join('\n'))).toEqual(['e2e (1)']);
		const reporting = [...skipped.slice(0, 2), '    continue-on-error: true', ...skipped.slice(2)];
		expect(unreportableGates(reporting.join('\n'))).toEqual([]);
		const expression = ['jobs:', '  e2e:', '    continue-on-error: ${{ matrix.x }}'].join('\n');
		expect(() => checkNames(expression)).toThrow(/true or false only/);
	});

	it('follows a job rename rather than the hand-written list', () => {
		const renamed = readFileSync(path.join(WORKFLOWS, CI), 'utf8').replace(
			/^ {2}unit:$/m,
			'  static:'
		);
		expect(checkNames(renamed)).toContain('static');
		expect(checkNames(renamed)).not.toContain('unit');
	});

	it('reads a display name over the job id, and a two-dimension matrix', () => {
		const yaml = [
			'jobs:',
			'  build:',
			'    name: Build the thing',
			'    runs-on: ubuntu-latest',
			'  matrixed:',
			'    strategy:',
			'      matrix:',
			"        os: ['ubuntu', 'macos']",
			'        node: [22, 24]',
			'  plain:',
			'    runs-on: ubuntu-latest',
			'permissions:',
			'  contents: read',
			'  never-a-job: true'
		].join('\n');
		expect(checkNames(yaml)).toEqual([
			'Build the thing',
			'matrixed (ubuntu, 22)',
			'matrixed (ubuntu, 24)',
			'matrixed (macos, 22)',
			'matrixed (macos, 24)',
			'plain'
		]);
	});

	it('refuses a matrix shape it cannot expand rather than under-reporting', () => {
		const yaml = ['jobs:', '  e2e:', '    strategy:', '      matrix:', '        include:'].join(
			'\n'
		);
		expect(() => checkNames(yaml)).toThrow(/include/);
	});

	it('reads both halves of the rule, comments dropped, and refuses a missing one', () => {
		expect(
			ciContexts("const CI_CONTEXTS = [\n\t// a note\n\t'unit',\n\t'e2e (1/4)' // trailing\n]")
		).toEqual(['unit', 'e2e (1/4)']);
		expect(() => ciContexts('const protection = {};')).toThrow(/CI_CONTEXTS/);
		expect(
			externalContexts("const EXTERNAL_CONTEXTS = {\n\t// why\n\t'cla.yml': ['cla', 'dco']\n};")
		).toEqual(new Map([['cla.yml', ['cla', 'dco']]]));
		expect(externalContexts('const EXTERNAL_CONTEXTS = {};')).toEqual(new Map());
		expect(() => externalContexts('const protection = {};')).toThrow(/EXTERNAL_CONTEXTS/);
	});

	it('reds on an external declared for a workflow that does not report it', () => {
		const declared = new Map([['cla.yml', ['cla']]]);
		expect(unreportedExternals(declared, new Map([['cla.yml', ['cla']]]))).toEqual([]);
		expect(unreportedExternals(declared, new Map([['cla.yml', ['signature']]]))).toEqual([
			'cla.yml: cla'
		]);
		expect(unreportedExternals(declared, new Map())).toEqual(['cla.yml: no such workflow']);
	});

	it('reds on a required name an undeclared workflow reports, pair by pair', () => {
		const declared = new Map([['cla.yml', ['cla']]]);
		const names = ['unit', 'cla'];
		expect(undeclaredReporters(names, declared, new Map([['cla.yml', ['cla']]]))).toEqual([]);
		expect(undeclaredReporters(names, declared, new Map([['cla.yml', ['cla', 'unit']]]))).toEqual([
			'cla.yml: unit'
		]);
		expect(undeclaredReporters(names, declared, new Map([['deploy.yml', ['cla']]]))).toEqual([
			'deploy.yml: cla'
		]);
	});
});
