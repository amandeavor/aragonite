/**
 * G4.224: a press on editor chrome takes no focus. Engines differ on where a pressed button puts it,
 * so every `<button>` in a component or a bundled plugin's view sits under a mousedown or pointerdown
 * handler that prevents the default, or its file is listed below as owning focus on purpose
 * (`docs/design/editor.md` § Browser engines).
 */

import { parse } from 'svelte/compiler';
import { describeFileRules, svelteOnly, under, type FileRule } from './file-rule';
import { collectEditorSources, walkCode, type SourceFile } from './scan-source';
import { SOURCE, SOURCE_DIR } from './source-paths';

const PRESS_EVENTS = new Set(['mousedown', 'pointerdown']);

interface Node {
	type?: string;
	name?: string;
	start: number;
	end: number;
	attributes?: Node[];
	value?: Node | Node[] | true;
	expression?: Node;
	modifiers?: string[];
}

/** The source of the function `name` declared in the component's script, or null. */
function declaredFunction(code: string, name: string): string | null {
	const at = code.search(new RegExp(`function\\s+${name}\\s*\\(|const\\s+${name}\\s*=`));
	const open = at < 0 ? -1 : code.indexOf('{', at);
	if (open < 0) return null;
	let depth = 0;
	const close = walkCode(code, open, (ch) => {
		if (ch === '{') depth++;
		else if (ch === '}') return --depth === 0;
	});
	return code.slice(at, close + 1);
}

function preventsPress(attribute: Node, code: string): boolean {
	if (attribute.type === 'OnDirective') {
		return (
			PRESS_EVENTS.has(attribute.name ?? '') && !!attribute.modifiers?.includes('preventDefault')
		);
	}
	const event = attribute.name?.startsWith('on') ? attribute.name.slice(2) : '';
	if (attribute.type !== 'Attribute' || !PRESS_EVENTS.has(event)) return false;
	if (typeof attribute.value !== 'object') return false;
	const handler = (Array.isArray(attribute.value) ? attribute.value[0] : attribute.value)
		?.expression;
	if (!handler) return false;
	const source =
		handler.type === 'Identifier'
			? declaredFunction(code, handler.name ?? '')
			: code.slice(handler.start, handler.end);
	return !!source?.includes('preventDefault');
}

/** Whether some `<button>` in the markup has no element, itself included, that prevents a press. */
function buttonTakesFocus(file: SourceFile): boolean {
	const ast = parse(file.code, { modern: true });
	let found = false;
	const walk = (value: unknown, guarded: boolean): void => {
		if (found || value === null || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const item of value) walk(item, guarded);
			return;
		}
		const node = value as Node;
		let inner = guarded;
		if (node.type === 'RegularElement') {
			inner = guarded || (node.attributes ?? []).some((a) => preventsPress(a, file.code));
			if (node.name === 'button' && !inner) {
				found = true;
				return;
			}
		}
		for (const [key, child] of Object.entries(node)) {
			if (key !== 'attributes') walk(child, inner);
		}
	};
	walk(ast.fragment, false);
	return found;
}

const svelteProbe = (code: string) => ({ relPath: `${SOURCE_DIR.components}Probe.svelte`, code });

const CHROME_PRESS_FOCUS: FileRule = {
	id: 'G4.224 a press on editor chrome takes no focus',
	population: (file) => svelteOnly(file) && under(SOURCE_DIR.components, SOURCE_DIR.plugins)(file),
	matches: buttonTakesFocus,
	allowed: {
		'src/lib/components/SearchBar.svelte':
			'the find bar holds focus while open and puts the caret back through `selection/caret-restore.ts`',
		'src/lib/components/link-card/LinkCard.svelte':
			'the link card holds focus in its field and gives the caret back through `selection/caret-restore.ts`',
		'src/lib/components/blocks/table/TableActionMenu.svelte':
			'an ARIA menu with roving focus, which Escape returns to the cell it opened from',
		'src/lib/components/blocks/code/CodeBlockRail.svelte':
			'the rail is a tab stop of its own, shown on focus-within, and its menu hands focus back to the ⋮ button',
		'src/lib/plugins/mermaid/MermaidBlock.svelte':
			'Edit and Focus move focus on purpose, to the source field and the full-window view',
		'src/lib/plugins/toc/TocBlock.svelte':
			'its entries are real buttons for tab order and Enter, and a press moves the caret to the heading'
	},
	reason:
		'an engine decides where a pressed button puts focus, and focus off the caret block loses the editor its keys: prevent the default on mousedown at the chrome root (`onmousedown={(e) => e.preventDefault()}`, as the selection toolbar does), or, for chrome that holds focus on purpose, list the file here with where it gives focus back',
	reaches: [SOURCE.imageProperties, SOURCE.tableBlock],
	hits: [
		svelteProbe('<div class="bar"><button>x</button></div>'),
		svelteProbe('<button onclick={go}>x</button>'),
		svelteProbe('<div onmousedown={(e) => e.stopPropagation()}><button>x</button></div>'),
		svelteProbe(
			'<script>function keep(e) { e.stopPropagation(); }</script><div onmousedown={keep}><button>x</button></div>'
		),
		svelteProbe('<button onmousedown={(e) => e.preventDefault()}>a</button><button>b</button>'),
		svelteProbe('{#if open}<span><button>x</button></span>{/if}')
	],
	misses: [
		svelteProbe('<button onmousedown={(e) => e.preventDefault()}>x</button>'),
		svelteProbe(
			'<div onpointerdown={(e) => e.preventDefault()}>{#each xs as x}<button>{x}</button>{/each}</div>'
		),
		svelteProbe(
			'<script>function keep(e) { if (e.button === 0) e.preventDefault(); }</script><div onmousedown={keep}><button>x</button></div>'
		),
		svelteProbe('<div class="bar"><span>no buttons</span></div>')
	]
};

describeFileRules([CHROME_PRESS_FOCUS], collectEditorSources());
