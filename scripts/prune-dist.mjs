// svelte-package copies all of src/lib into dist, tests included; strip them before pack.
// It also writes a .d.mts beside each script a test imports, which would shadow that script's
// JSDoc types for svelte-check once the script changes, so those go too.
import { readdirSync, rmSync } from 'node:fs';

for (const target of ['dist/test', 'dist/e2e']) {
	rmSync(target, { recursive: true, force: true });
}
for (const name of readdirSync('scripts')) {
	if (name.endsWith('.d.mts')) rmSync(`scripts/${name}`);
}
