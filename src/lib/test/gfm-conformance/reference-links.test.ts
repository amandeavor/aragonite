// Links resolved through a document's definitions, compared against commonmark.js: each spec
// example holding a definition, every top-level paragraph read with a resolver over them.
// Miss-analysis: the ratchet skips any input whose parse consumed a definition, so a reference
// link resolved to the wrong url or title, or not at all, passed it.
import { describe, expect, it } from 'vitest';
import { Parser, type Node } from 'commonmark';
import {
	getContentRange,
	parse,
	parseInline,
	type CstNode,
	type LinkReferenceDefinitionMetadata
} from '#lib';
import { loadSpecExamples, loadDefinitionExamples } from './corpus';
import { editorOutline, referenceOutline } from './block-outline';
import { explainDivergence } from './excuses';
import { normalEqual, normalizeAragonite, normalizeReference, type NormalNode } from './normalize';

const DEFINITION_LINE = /^ {0,3}\[[^\]]+\]:/m;

// Label matching as commonmark.js does it, case fold included, written here so the resolver is
// the test's own, not the editor's.
const normalizeLabel = (label: string) =>
	label
		.replace(/[ \t\n\v\f\r]+/g, ' ')
		.replace(/^ | $/g, '')
		.toLowerCase()
		.toUpperCase();

/** The first definition of each label wins, nested ones included, in document order. */
function resolverFor(blocks: CstNode[]) {
	const definitions = new Map<string, { url: string; title?: string }>();
	const visit = (nodes: CstNode[]): void => {
		for (const node of nodes) {
			if (node.kind === 'linkReferenceDefinition') {
				const { label, url, title } = node.metadata as LinkReferenceDefinitionMetadata;
				const key = normalizeLabel(label);
				if (url !== undefined && !definitions.has(key)) {
					definitions.set(key, title === undefined ? { url } : { url, title });
				}
			}
			if (node.children) visit(node.children);
		}
	};
	visit(blocks);
	return (label: string) => definitions.get(normalizeLabel(label));
}

function referenceParagraphs(markdown: string): Node[][] {
	const paragraphs: Node[][] = [];
	for (let block = new Parser().parse(markdown).firstChild; block; block = block.next) {
		if (block.type !== 'paragraph') continue;
		const inlines: Node[] = [];
		for (let child = block.firstChild; child; child = child.next) inlines.push(child);
		paragraphs.push(inlines);
	}
	return paragraphs;
}

// The block layer strips a continuation line's indent and a paragraph's trailing spaces before
// the reference's inline stage; the editor keeps those bytes, so such paragraphs compare unlike.
const readsAsReference = (text: string) => !/\n[ \t]|[ \t]$/.test(text);

const examples = [...loadSpecExamples(), ...loadDefinitionExamples()].filter(
	(example, i, all) =>
		DEFINITION_LINE.test(example.markdown) &&
		all.findIndex((other) => other.example === example.example) === i
);

// Known divergences, each awaiting the owner's ruling; a fixed one must leave this list.
const DEVIATIONS: Record<number, string> = {
	545: 'a full reference with no definition is one opaque node, so its escapes stay unread'
};

interface Comparison {
	example: number;
	ours: NormalNode[];
	theirs: NormalNode[];
}

/** Every top-level paragraph both parsers read as the same block and the same bytes. */
function comparisons(example: number, markdown: string): Comparison[] {
	if (editorOutline(markdown).join('|') !== referenceOutline(markdown).join('|')) return [];
	const blocks = parse(markdown).children;
	const resolve = resolverFor(blocks);
	const theirs = referenceParagraphs(markdown);
	return blocks
		.filter((block) => block.kind === 'paragraph')
		.flatMap((paragraph, i) => {
			const { start, end } = getContentRange(paragraph);
			if (!readsAsReference(paragraph.raw.slice(start, end))) return [];
			const nodes = parseInline(paragraph.raw, start, end, resolve);
			const ours = normalizeAragonite(nodes, paragraph.raw);
			return [{ example, ours, theirs: normalizeReference(theirs[i]) }];
		});
}

describe('reference links through definitions, against commonmark.js', () => {
	const compared = examples.flatMap(({ example, markdown }) => comparisons(example, markdown));
	const diverging = compared.filter(({ ours, theirs }) => !normalEqual(ours, theirs));
	const unexplained = diverging.filter(
		(d) =>
			!(d.example in DEVIATIONS) &&
			explainDivergence({ input: String(d.example), ours: d.ours, theirs: d.theirs }) !==
				'image-alt-structure'
	);

	it('compares enough paragraphs to judge', () => {
		expect(compared.length).toBeGreaterThan(60);
	});

	it('every divergence is an image alt or a listed deviation', () => {
		expect(unexplained).toEqual([]);
	});

	it('every listed deviation still diverges', () => {
		const still = new Set(diverging.map((d) => d.example));
		expect(Object.keys(DEVIATIONS).filter((example) => !still.has(Number(example)))).toEqual([]);
	});
});
