// One-shot: apply branch protection to `main` (not `dev`, whose history rewrites need a force
// push). Needs gh authenticated as a repo admin; a private free-plan repo answers 403. The required
// checks are the lists in `branch-protection-contexts.mjs`. Admins stay exempt, so a maintainer
// can still merge when the other maintainer is unreachable.
import { execFileSync } from 'node:child_process';
import { CI_CONTEXTS, EXTERNAL_CONTEXTS } from './branch-protection-contexts.mjs';

const REPO = 'voithos-labs/aragonite';
const BRANCH = 'main';

const protection = {
	required_status_checks: {
		// Not strict: a PR need not be rebased onto every push to main first. A run takes tens of
		// minutes, so strict mode would re-queue every open PR on every merge, and the run on push
		// to main catches what a stale base lets through.
		strict: false,
		contexts: [...CI_CONTEXTS, ...Object.values(EXTERNAL_CONTEXTS).flat()]
	},
	enforce_admins: false,
	// Present with a count of 1, so every change arrives as a PR and an outside fork's PR needs
	// a maintainer's approval. Both maintainers are code owners, so either can approve the other.
	required_pull_request_reviews: {
		dismiss_stale_reviews: true,
		require_code_owner_reviews: true,
		required_approving_review_count: 1
	},
	// Null is "anyone with write may push"; a list here would be a second, narrower gate on top
	// of the reviews.
	restrictions: null,
	allow_force_pushes: false,
	allow_deletions: false,
	required_conversation_resolution: true
};

const endpoint = `repos/${REPO}/branches/${BRANCH}/protection`;

try {
	execFileSync('gh', ['api', '-X', 'PUT', endpoint, '--input', '-'], {
		input: JSON.stringify(protection),
		encoding: 'utf8'
	});
} catch (err) {
	const detail = `${err.stdout ?? ''}${err.stderr ?? ''}`;
	if (detail.includes('Upgrade to GitHub Pro')) {
		console.error(
			`${BRANCH} protection NOT applied: the API plan-gates this on private free-plan repos.\n` +
				'Expected before the flip to public. Re-run once the repo is public.'
		);
		process.exit(1);
	}
	throw err;
}

// Read back rather than echo the payload: the API silently drops fields a plan or a repo
// setting does not support, so what landed is the only thing worth printing.
console.log(`${BRANCH} branch protection applied. Live rule:`);
console.log(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
