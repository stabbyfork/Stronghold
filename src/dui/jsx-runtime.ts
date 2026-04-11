import { Dui } from './core.js';

type JsxProps = Record<string, unknown> & {
	children?: Dui.Child | Dui.Child[];
};

export const Fragment = Dui.Fragment;

function normalizeJsxChildren(children: JsxProps['children']): Dui.Child[] {
	if (children === undefined) return [];
	if (Array.isArray(children)) return children;
	return [children];
}

export function jsx(type: Dui.ElementType, props: JsxProps): Dui.ElementNode {
	const input = props ?? {};
	const { children, ...rest } = input;
	return Dui.createElement(type, rest as never, ...normalizeJsxChildren(children));
}

export const jsxs = jsx;

export function jsxDEV(type: Dui.ElementType, props: JsxProps): Dui.ElementNode {
	return jsx(type, props);
}
