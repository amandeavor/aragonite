/**
 * G4.189: inside the editor a host color read carries no fallback, since `editor.css` resolves every
 * one to the page's value or the palette in the editor's mode; a literal there would pin one mode.
 * The root itself sits above where the resolved names are taken, so its rules read those.
 */
import { describe, it, expect } from 'vitest';
import { collectEditorSources, readSource, splitTopLevel, type SourceFile } from './scan-source';
import { SOURCE } from './source-paths';

const FALLBACK_READ = /var\(\s*(--color-[a-z0-9-]+)\s*,/g;
const ANY_READ = /var\(\s*(--color-[a-z0-9-]+)/g;
/** The editor.css declarations that resolve a host color, the one place a fallback belongs. */
const RESOLVE_DECLARATION = /^(?:--md-color-[a-z0-9-]+|--md-page-text)$/;
const ROOT_CLASS = /\.(?:editor|aragonite-editor-portal)(?![\w-])/;

// Route pages are the host around the editor, which reads its own tokens however it likes.
const isHostPage = (f: SourceFile) => /\/\+(?:page|layout)\.svelte$/.test(f.relPath);

function surfaces(): SourceFile[] {
	return [
		...collectEditorSources().filter((f) => !isHostPage(f)),
		readSource(SOURCE.editorCss),
		readSource(SOURCE.themeTokens)
	];
}

/** The stylesheet text of a source: a component's style blocks, a stylesheet whole. */
function styleOf(file: SourceFile): string {
	if (file.relPath.endsWith('.css')) return file.code;
	return [...file.code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

interface Rule {
	selector: string;
	declarations: Array<{ name: string; value: string }>;
}

function rulesOf(css: string): Rule[] {
	return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
		selector: selector.trim(),
		declarations: body
			.split(';')
			.map((part) => part.split(/:(.*)/s))
			.filter((pair) => pair.length > 1)
			.map(([name, value]) => ({ name: name.trim(), value: value.trim() }))
	}));
}

/** Whether a selector's subject (its last compound) is the editor root or the moved find bar. */
function selectsRoot(selector: string): boolean {
	return splitTopLevel(selector, ',').some((complex) => {
		const compounds = splitTopLevel(complex.replace(/\s*[>+~]\s*|\s+/g, ' ').trim(), ' ');
		return ROOT_CLASS.test(compounds[compounds.length - 1] ?? '');
	});
}

function fallbackOffenders(file: SourceFile): string[] {
	if (file.relPath !== SOURCE.editorCss) {
		return [...file.code.matchAll(FALLBACK_READ)].map((m) => `${m[1]} in ${file.relPath}`);
	}
	return rulesOf(file.code).flatMap(({ declarations }) =>
		declarations
			.filter(({ name }) => !RESOLVE_DECLARATION.test(name))
			.flatMap(({ name, value }) =>
				[...value.matchAll(FALLBACK_READ)].map((m) => `${m[1]} in ${name}`)
			)
	);
}

function rootReadOffenders(file: SourceFile): string[] {
	return rulesOf(styleOf(file))
		.filter(({ selector }) => selectsRoot(selector))
		.flatMap(({ selector, declarations }) =>
			declarations
				.filter(({ name }) => !RESOLVE_DECLARATION.test(name))
				.flatMap(({ name, value }) =>
					[...value.matchAll(ANY_READ)].map((m) => `${m[1]} in ${file.relPath} ${selector} ${name}`)
				)
		);
}

describe('G4.189 host color reads inside the editor', () => {
	it('carry no fallback outside the resolving declarations in editor.css', () => {
		const offenders = surfaces().flatMap(fallbackOffenders);
		expect(offenders, `host color reads with a fallback: ${offenders.join(', ')}`).toEqual([]);
	});

	it('never come raw from a rule on the root, which sees the page’s value unresolved', () => {
		const offenders = surfaces().flatMap(rootReadOffenders);
		expect(offenders, `root rules reading a host color: ${offenders.join(', ')}`).toEqual([]);
	});
});

describe('G4.189 matcher non-vacuity', () => {
	it('the scan reaches the root rules the editor component declares', () => {
		const editor = surfaces().find((f) => f.relPath.endsWith('components/Editor.svelte'));
		const root = rulesOf(styleOf(editor!)).filter(({ selector }) => selectsRoot(selector));
		expect(root.map(({ selector }) => selector)).toContain('.editor::-webkit-scrollbar-thumb');
	});

	it('the subject test takes the root and its pseudo-elements, never a descendant', () => {
		expect(selectsRoot('.editor')).toBe(true);
		expect(selectsRoot(".editor[data-scroll-mode='host']")).toBe(true);
		expect(selectsRoot('.editor::-webkit-scrollbar-thumb:hover')).toBe(true);
		expect(selectsRoot(':where(.editor, .aragonite-editor-portal)')).toBe(true);
		expect(selectsRoot(':where(.editor) .md-menu')).toBe(false);
		expect(selectsRoot(':where(.editor, .aragonite-editor-portal) > *')).toBe(false);
		expect(selectsRoot('.editor-header')).toBe(false);
		expect(
			selectsRoot(":where(.editor):is(\n\t[data-presentation='live']\n)\n\t.task-checkbox")
		).toBe(false);
	});

	it('both checks flag a synthetic offender', () => {
		const file = (code: string): SourceFile => ({ relPath: 'x.css', text: code, code });
		expect(fallbackOffenders(file('a { color: var(--color-bg, #000); }'))).toHaveLength(1);
		expect(rootReadOffenders(file('.editor { color: var(--color-bg); }'))).toHaveLength(1);
		expect(rootReadOffenders(file('.editor .x { color: var(--color-bg); }'))).toEqual([]);
	});
});
