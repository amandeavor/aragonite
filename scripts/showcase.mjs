// Serves the showcase in the React or Vue example app, built from this checkout the way a user
// installs it: `npm run showcase:react` or `npm run showcase:vue`, then open the printed URL.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APPS = {
	react: { dir: 'examples/react', wrapper: 'react', port: 1490 },
	vue: { dir: 'examples/vue', wrapper: 'vue', port: 1495 }
};

const app = APPS[/** @type {keyof typeof APPS} */ (process.argv[2])];
if (!app) {
	console.error(`usage: node scripts/showcase.mjs ${Object.keys(APPS).join('|')}`);
	process.exit(1);
}

/** @param {string} command @param {string} [cwd] */
const run = (command, cwd) => execSync(command, { stdio: 'inherit', cwd });

const packs = path.resolve('tmp/packs');
mkdirSync(packs, { recursive: true });
run('npm run package');
run(
	`npm pack --workspaces --include-workspace-root --ignore-scripts --pack-destination "${packs}"`
);

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tarballs = ['aragonite', `aragonite-${app.wrapper}`].map((name) =>
	path.join(packs, `voithos-labs-${name}-${version}.tgz`)
);
if (!existsSync(path.join(app.dir, 'node_modules'))) run('npm ci', app.dir);
run(`npm install --no-save ${tarballs.map((file) => `"${file}"`).join(' ')}`, app.dir);

console.log(`\nShowcase: http://localhost:${app.port}/showcase.html (Ctrl+C stops it)\n`);
run('npm run dev', app.dir);
