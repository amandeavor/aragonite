// The framework apps the suite drives: where each lives, how it serves, the framework version its
// page must report (a prefix), the specs it runs, and whether it gates every PR or only a release.
// `scripts/adapter-smoke.mjs` builds and runs whatever this lists.
const REACT = ['page-contract'];
const VUE = ['page-contract', 'vue'];
// The example apps also serve the showcase (`showcase.html`); the meta-framework apps do not.
const SHOWCASE = 'showcase';

export const APPS = {
	react: {
		cwd: '../react',
		command: 'npm run preview',
		port: 1489,
		version: '19.',
		specs: [...REACT, SHOWCASE],
		perPr: true
	},
	'react-dev': {
		cwd: '../react',
		command: 'npm run dev',
		port: 1490,
		version: '19.',
		specs: [...REACT, SHOWCASE],
		perPr: true
	},
	next: {
		cwd: '../next',
		command: 'npm start',
		port: 1491,
		version: '19.',
		specs: [...REACT, 'ssr', 'next'],
		perPr: false
	},
	react18: {
		cwd: '../react',
		command: 'npm run preview:react18',
		port: 1492,
		version: '18.',
		specs: [...REACT, SHOWCASE],
		perPr: false
	},
	vue: {
		cwd: '../vue',
		command: 'npm run preview',
		port: 1494,
		version: '3.',
		specs: [...VUE, SHOWCASE],
		perPr: true
	},
	'vue-dev': {
		cwd: '../vue',
		command: 'npm run dev',
		port: 1495,
		version: '3.',
		specs: [...VUE, SHOWCASE],
		perPr: true
	},
	nuxt: {
		cwd: '../nuxt',
		command: 'npm start',
		port: 1496,
		version: '3.',
		specs: ['page-contract', 'ssr'],
		perPr: false
	},
	vue33: {
		cwd: '../vue',
		command: 'npm run preview:vue33',
		port: 1497,
		version: '3.3.',
		specs: [...VUE, SHOWCASE],
		perPr: false
	}
};
