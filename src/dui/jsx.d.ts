import type { Dui } from './core.js';

declare global {
	namespace JSX {
		type Element = Dui.ElementNode;
		interface ElementChildrenAttribute {
			children: {};
		}
		interface IntrinsicElements extends Dui.Intrinsics {
			fragment: Record<string, never>;
		}
	}
}

export {};
