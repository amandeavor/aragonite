// The framework apps the suite drives: where each lives, how it serves, and its React major.
export const APPS = {
	react: { cwd: '../react', command: 'npm run preview', port: 1489, reactMajor: '19' },
	'react-dev': { cwd: '../react', command: 'npm run dev', port: 1490, reactMajor: '19' },
	next: { cwd: '../next', command: 'npm start', port: 1491, reactMajor: '19' },
	react18: { cwd: '../react', command: 'npm run preview:react18', port: 1492, reactMajor: '18' }
};

export type AppName = keyof typeof APPS;
