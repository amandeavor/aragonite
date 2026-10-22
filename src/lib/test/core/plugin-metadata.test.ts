import { describe, it, expect } from 'vitest';
import {
	setPluginMetadata,
	getPluginMetadata,
	metadataIfKind,
	metadataOf,
	type CstNode
} from '../../core/nodes';
import { parse } from '../../core/parser';
import { takeDevWarns } from '../support/warn-gate';

interface CalloutMetadata {
	calloutType: string;
}

const bareNode = (): CstNode => ({ kind: 'paragraph', leadingTrivia: '', raw: '' });

describe('plugin metadata accessors', () => {
	it('round-trips a plugin-owned shape not present in the BlockMetadata union', () => {
		const node = bareNode();
		setPluginMetadata<CalloutMetadata>(node, { calloutType: 'warning' });
		expect(getPluginMetadata<CalloutMetadata>(node)?.calloutType).toBe('warning');
	});

	it('reads undefined when no metadata is stored', () => {
		expect(getPluginMetadata<CalloutMetadata>(bareNode())).toBeUndefined();
	});

	it('overwrites prior metadata rather than merging', () => {
		const node = bareNode();
		setPluginMetadata(node, { calloutType: 'note', dismissed: false });
		setPluginMetadata<CalloutMetadata>(node, { calloutType: 'tip' });
		expect(getPluginMetadata<Record<string, unknown>>(node)).toEqual({ calloutType: 'tip' });
	});
});

// Miss-analysis: every metadata read was handed the kind it named, so a container whose own
// metadata carries a list's field read as a list.
describe('G1.122 a built-in metadata read answers only for the kind it names', () => {
	const orderedQuote = () => {
		const quote = parse('> a\n').children[0];
		setPluginMetadata(quote, { ordered: true });
		return quote;
	};

	it('metadataIfKind gives no list metadata for a non-list that says ordered', () => {
		expect(metadataIfKind(orderedQuote(), 'list')).toBeUndefined();
		expect(metadataIfKind(parse('1. a\n').children[0], 'list')).toEqual({ ordered: true });
	});

	it('metadataOf on a node of another kind fails the dev gate', () => {
		metadataOf(orderedQuote(), 'list');
		expect(takeDevWarns().map((w) => w.tag)).toEqual(['invariant:metadata-of-kind']);
	});
});
