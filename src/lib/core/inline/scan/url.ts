// Percent-encoding as mdurl's encoder does it, which commonmark.js runs destinations through.

const UNSAFE = /%[0-9A-Fa-f]{2}|[^A-Za-z0-9;/?:@&=+$,\-_.!~*'()#%]|%/gu;

export function encodeUrl(url: string): string {
	return url.replace(UNSAFE, (ch) => {
		if (ch.length === 3) return ch;
		if (ch === '%') return '%25';
		const lone = ch.length === 1 && ch >= '\uD800' && ch <= '\uDFFF';
		return lone ? '%EF%BF%BD' : encodeURIComponent(ch);
	});
}
