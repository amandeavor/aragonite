/** Text escaped so a block that reads Markdown shows it exactly as written: Paste as plain text. */
export function escapeMarkdownLiteral(text: string): string {
	return text
		.replace(/[\\`*_[\]<>|~]/g, '\\$&')
		.replace(/^([ \t]*)([#>+-])/gm, '$1\\$2')
		.replace(/^([ \t]*)(\d+)([.)])/gm, '$1$2\\$3');
}
