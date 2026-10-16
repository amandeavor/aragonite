/**
 * An e2e spec drives the browser through the shared helpers, each of which waits for what a raw
 * call skips: composition through the IME driver (G4.49), navigation through `gotoReady` and
 * `reloadReady`, and a mode switch through a helper that waits for the mode (G4.133). Runs with
 * the other e2e lints, outside `test:editor:invariants`. Probe text is spelled in pieces, since
 * this file is scanned too.
 */
import { it, expect } from 'vitest';
import { collectFiles, readSource } from '../../test/invariants/lint/scan-source';
import { describeManifests } from '../../test/invariants/lint/file-rule';

const files = collectFiles('src/lib/e2e', { extensions: ['.ts'] }).map(readSource);

const IME_DRIVER = 'src/lib/e2e/simulation/ime.ts';
const NAVIGATION_HELPER = 'src/lib/e2e/goto-ready.ts';
const BRIDGE_HOME = 'src/lib/e2e/editor-page.ts';
const CONTROL_HOME = 'src/lib/e2e/mode-switch.ts';

const COMPOSITION = 'Composition';
const nav = (receiver: string, call: string) => `await ${receiver}.${call}`;
const bridge = '(window as any).__' + 'test';
const setter = 'setPresentation' + 'Mode';

// No page object here has a reload or history method, and `EditorPage.goto` takes a query, not a route.
const RAW_GOTO = /(?<![\w$])page\s*\.\s*goto\s*\(|\.\s*goto\s*\(\s*['"`](?:\/|https?:)/;
const RAW_HISTORY = /\.\s*(?:reload|goBack|goForward)\s*\(/;

describeManifests(
	[
		{
			id: 'G4.49 e2e composition rides the shared IME driver, the only file building the events',
			// Both ways around the driver: the event itself, and the input event carrying its bytes.
			matches: new RegExp(`new\\s+${COMPOSITION}Event\\s*\\(|insert${COMPOSITION}Text`),
			declared: { [IME_DRIVER]: 'the WebKit branch: WebKit has no CDP to compose through' },
			reason:
				'drive the composition through attachIme (e2e/simulation/ime.ts): a synthetic event skips the browser composition window',
			hits: [
				`new ${COMPOSITION}Event('compositionstart')`,
				`{ inputType: 'insert${COMPOSITION}Text' }`
			],
			misses: ['await ime.compose("か");']
		},
		{
			id: 'G4.49 the CDP branch is where Chromium composition lives',
			matches: new RegExp(`Input\\.ime${'Set'}${COMPOSITION}`),
			declared: { [IME_DRIVER]: 'the Chromium branch' },
			reason: `Chromium composes through the CDP branch of ${IME_DRIVER}`,
			hits: [`await cdp.send('Input.ime${'Set'}${COMPOSITION}', params);`],
			misses: [`await cdp.send('Input.insertText', params);`]
		},
		// Miss-analysis: each spec wrote its own wait and no scan held them to one, so one waited on
		// markup. A `goto(variable)` on a page spelled otherwise still gets past the matcher.
		{
			id: 'every e2e page navigation waits for the route to hydrate',
			matches: RAW_GOTO,
			declared: { [NAVIGATION_HELPER]: 'gotoReady, which waits for the readiness global' },
			reason: `navigate with gotoReady (${NAVIGATION_HELPER}): a raw navigation can act before hydration`,
			hits: [
				nav('page', "goto('/')"),
				nav('this.page', 'goto(url)'),
				nav('homepage', "goto('/')"),
				nav('p', "goto('/x')"),
				nav('popup', 'goto(`http://localhost/`)')
			],
			misses: [
				nav('editor', "goto('?presentationMode=live')"),
				nav('editor', "goto('')"),
				nav('ep', 'goto(query)'),
				"await gotoReady(page, '/test/syntax')"
			]
		},
		{
			id: 'every e2e reload or history step waits for the route to hydrate',
			matches: RAW_HISTORY,
			declared: { [NAVIGATION_HELPER]: 'reloadReady, which waits for the readiness global' },
			reason: `reload with reloadReady (${NAVIGATION_HELPER}): a raw reload can act before hydration`,
			hits: [nav('editor.page', 'reload()'), nav('page', 'goBack()'), nav('second', 'reload()')],
			misses: ['await reloadReady(page)']
		},
		// Miss-analysis: two selection specs stayed green with the harness dropping live mode to
		// source. An alias of the bridge held across statements still gets past the matcher.
		{
			id: 'G4.133 every e2e mode switch through the bridge waits for the mode to apply',
			matches:
				/\b__test\b[^;]*?\bsetPresentationMode\b|\bsetPresentationMode\b[^;]*?=\s*[^;]*?\b__test\b/,
			declared: { [BRIDGE_HOME]: 'EditorPage.setPresentationMode, which waits for the mode' },
			reason: `call EditorPage.setPresentationMode (${BRIDGE_HOME}), which waits for the mode to apply`,
			hits: [
				`await page.evaluate(() => ${bridge}.${setter}('live'));`,
				`page.evaluate((m) =>\n\t${bridge}\n\t\t.${setter}(m), mode);`,
				`const { ${setter} } = ${bridge};`,
				`${bridge}['${setter}']('reading');`
			],
			misses: [
				`await ep.${setter}('live');`,
				`await page.evaluate(() => ${bridge}.getSource());\nawait ep.${setter}('live');`
			]
		},
		{
			id: 'G4.133 every e2e mode toggle or mode button click waits for the mode to apply',
			// The test route's header checkboxes, and the showcase's and changelog's mode buttons.
			matches:
				/\b(?:presentation|live|preview-block|preview-inline)-toggle\b|\b(?:showcase|changelog)-mode\b/,
			declared: {
				[CONTROL_HOME]: 'clickModeToggle and clickModeButton, which wait for the mode',
				'src/lib/e2e/tests/keybinding-multi-editor.spec.ts':
					'focuses the reading toggle without clicking it, so the mode never changes',
				'src/lib/e2e/tests/mobile-showcase.spec.ts':
					'taps a mode button on a phone layout and checks the mode itself'
			},
			reason: `click it with clickModeToggle or clickModeButton (${CONTROL_HOME}), which wait for the mode to apply`,
			hits: [
				`page.getByTestId('live-${'toggle'}')`,
				`['reading', 'presentation-${'toggle'}']`,
				`testid: 'preview-inline-${'toggle'}'`,
				`page.locator('.showcase-${'mode'}[data-mode="live"]')`,
				`page.locator('.changelog-${'mode'}')`
			],
			misses: [
				`page.getByTestId('theme-${'toggle'}')`,
				`page.locator('.showcase-${'modes'}')`,
				`await clickModeToggle(page, 'live');`
			]
		}
	],
	files
);

it('the navigation helper wraps exactly a goto and a reload', () => {
	const helper = files.find((file) => file.relPath === NAVIGATION_HELPER);
	const calls = [...(helper?.code ?? '').matchAll(/\.\s*(goto|reload|goBack|goForward)\s*\(/g)];
	expect(calls.map((m) => m[1])).toEqual(['goto', 'reload']);
});
