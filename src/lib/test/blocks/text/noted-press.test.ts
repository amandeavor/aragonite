// @vitest-environment jsdom
// A press's reading is held for its own click only: every way the press ends without one drops it.
// Miss-analysis: the record's lifetime was reached only through the press rows, none of which ended
// a press without a click.
import { afterEach, describe, expect, it } from 'vitest';
import { createNotedPress } from '#lib/components/blocks/text/noted-press.js';

afterEach(() => document.body.replaceChildren());

function noted() {
	const surface = document.createElement('div');
	const inside = document.createElement('span');
	surface.append(inside);
	const elsewhere = document.createElement('div');
	document.body.append(surface, elsewhere);
	const press = createNotedPress<string>();
	press.note('reading', surface);
	const fire = (type: string, target: EventTarget) =>
		target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
	return { press, inside, elsewhere, fire };
}

describe('the noted press', () => {
	it('hands its reading to the click once', () => {
		const { press, inside, fire } = noted();
		fire('pointerup', inside);
		expect(press.take()).toBe('reading');
		expect(press.take()).toBeNull();
	});

	it.each([
		['a release outside its surface', 'pointerup'],
		['a cancel', 'pointercancel'],
		['the next press', 'pointerdown']
	])('drops its reading on %s', (_, type) => {
		const { press, elsewhere, fire } = noted();
		fire(type, elsewhere);
		expect(press.take()).toBeNull();
	});
});
