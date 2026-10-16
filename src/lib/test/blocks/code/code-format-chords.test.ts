// @vitest-environment jsdom
// A code block binds the same format chords as text, and claims each one without writing: it has
// no inline constructs, and an unclaimed chord would reach the browser's own bold or link.
// Miss-analysis: the e2e no-op checks pass either way, since a browser bold in the code block's
// plain-text surface changes nothing, so a format id the code block didn't claim went unseen.
import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';
import { getBlockKindDescriptor } from '#lib/schema/block-kind-descriptor.js';
import { inlineMarkForCommand } from '#lib/schema/inline-construct-policy.js';
import type { CommandId } from '#lib/schema/commands.js';
import { mountCode, type MountedCode } from './mount-code';

let mounted: MountedCode;
afterEach(async () => {
	if (mounted) await mounted.dispose();
	document.body.innerHTML = '';
});

const formatCommands = (kind: 'paragraph' | 'tableCell' | 'fencedCode'): string[] =>
	(getBlockKindDescriptor(kind).keymap ?? [])
		.map((binding) => binding.command)
		.filter((command) => inlineMarkForCommand(command) !== null || command === 'link.openCard');

describe('the code block and the format chords', () => {
	it('binds the same format chords as a paragraph and a table cell', () => {
		mounted = mountCode('```\ncode\n```\n');
		const commands = formatCommands('fencedCode');
		expect(commands.length).toBeGreaterThan(1);
		expect(formatCommands('paragraph')).toEqual(commands);
		expect(formatCommands('tableCell')).toEqual(commands);
	});

	it('claims each one and writes nothing', () => {
		mounted = mountCode('```\ncode\n```\n');
		for (const command of formatCommands('fencedCode')) {
			expect(mounted.instance.runCommand(command as CommandId), command).toBe(true);
		}
		expect(vi.mocked(mounted.blockEdit.updateBlockContent)).not.toHaveBeenCalled();
		expect(vi.mocked(mounted.blockEdit.replaceBlock)).not.toHaveBeenCalled();
	});
});
