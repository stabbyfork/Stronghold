//#region Generics

import parseDuration from 'parse-duration';
import { RecursiveFlatKeys, RecursiveFlatVals } from '../types/generics.js';

// Thanks ChatGPT
/**
 * Deeply transforms an object or array by applying a transformation function
 * to values that match a given predicate.
 *
 * @template T - Input type
 * @param value - The object, array, or primitive to transform
 * @param canTransform - Predicate function: decides if the value should be transformed
 * @param transform - Transformation function: maps the value to a new value
 * @returns A new deeply transformed object/array/primitive
 *
 * @example
 * const obj = { a: 1, b: { c: 2, d: [3, 4] } };
 * const result = deepTransform(
 *   obj,
 *   (val) => typeof val === "number",
 *   (val) => (val as number) * 10
 * );
 * // result: { a: 10, b: { c: 20, d: [30, 40] } }
 */
export function deepTransform<T>(
	value: T,
	canTransform: (val: unknown) => boolean,
	transform: (val: unknown) => unknown,
): unknown {
	if (canTransform(value)) {
		return transform(value) as T;
	}

	if (Array.isArray(value)) {
		return value.map((item) => deepTransform(item, canTransform, transform)) as unknown as T;
	}

	if (value !== null && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			result[key] = deepTransform(val, canTransform, transform);
		}
		return result as T;
	}

	return value;
}

export function wrapText<T extends string, W1 extends string, W2 extends string = W1>(
	text: T,
	wrapperLeft: W1,
	wrapperRight: W1 | W2 = wrapperLeft,
): `${W1}${T}${W2 | W1}` {
	return `${wrapperLeft}${text}${wrapperRight}`;
}

export function intDiv(a: number, b: number) {
	return (a / b) | 0;
}

export function caseToSpaced(s: string) {
	return s.replace(/([A-Z])/g, ' $1');
}

export function capitalise<S extends string>(str: S): Capitalize<S> {
	return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<S>;
}

/**
 * Returns the number of own enumerable string-keyed properties of an object.
 *
 * This is the same as {@link Object.keys | `Object.keys()`} but as a function.
 *
 * @param t The object to get the length from.
 * @returns The number of own enumerable string-keyed properties of the object.
 */
export function length(t: object) {
	return Object.keys(t).length;
}

/**
 * Recursively flattens the keys of an object into a new object.
 *
 * This function takes an object with potentially nested objects and
 * flattens its keys into a single object. Each key in the resulting
 * object corresponds to a key from the original object.
 *
 * If a value is an object, the function recursively processes its
 * properties, otherwise, it adds the key to the output object.
 *
 * @param obj The object to flatten the keys from.
 * @returns A new object with flattened keys.
 */
export function flattenKeys<T extends Record<any, any>, R extends { [V in RecursiveFlatKeys<T>]: V }>(obj: T): R {
	const out: R = {} as R;
	for (const [key, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			Object.assign(out, flattenKeys(val));
		} else {
			(out as any)[key] = key;
		}
	}
	return out;
}

export function flattenVals<T extends Record<any, any>>(obj: T): RecursiveFlatVals<T>[] {
	const out = [];
	for (const [_, val] of Object.entries(obj)) {
		if (typeof val === 'object' && val !== null) {
			out.push(...flattenVals(val));
		} else {
			out.push(val);
		}
	}
	return out;
}

export function objKeysEqual<T extends object>(a: object, b: T) {
	for (const key of Object.keys(a)) {
		if (!(key in b)) return false;
	}
	return true;
}

/**
 * Converts a duration string to a duration in milliseconds.
 *
 * The string should be in the format as specified by the `parse-duration` package.
 * If the string is invalid, the function returns `null`.
 *
 * @param str The duration string to parse.
 * @returns The duration in milliseconds, or `null` if the string is invalid.
 */
export function strToDuration(str: string) {
	const duration = parseDuration(str);
	return duration;
}

export function getValue<T>(obj: T, path: []): T | undefined;
export function getValue<T, K1 extends keyof T>(obj: T, path: [K1]): T[K1] | undefined;
export function getValue<T, K1 extends keyof T, K2 extends keyof T[K1]>(obj: T, path: [K1, K2]): T[K1][K2] | undefined;
export function getValue<T>(obj: T, path: (string | number)[]): unknown;
/**
 * Gets a value from an object by traversing the object using a path.
 *
 * The path is an array of strings or numbers that represent the path to the value.
 * The function starts from the given object and traverses the object by
 * following the path. If the path is invalid, the function returns `undefined`.
 *
 * @example
 * getValue({ a: { b: { c: 1 } } }, ['a', 'b', 'c']) // returns 1
 * getValue({ a: { b: { c: 1 } } }, ['a', 'b', 'd']) // returns undefined
 *
 * @param obj The object to traverse.
 * @param path The path to the value.
 * @returns The value at the given path, or `undefined` if the path is invalid.
 */
export function getValue<T>(obj: T, path: (string | number)[]): unknown {
	return path.reduce<any>((acc, key) => {
		if (acc && typeof acc === 'object' && key in acc) {
			return acc[key as keyof typeof acc];
		}
		return undefined;
	}, obj);
}

export function checkBits(obj: Record<string, number>) {
	const used = new Set();
	for (const key in obj) {
		const value = obj[key];
		if (used.has(value)) throw new Error(`Duplicate permission bit: ${key}`);
		if (Number.isNaN(value)) throw new Error(`NaN permission bit: ${key}`);
		if (!Number.isInteger(value)) throw new Error(`Non-integer permission bit: ${key}`);
		if (value <= 0) throw new Error(`Negative or zero permission bit: ${key}`);
		if (Math.log2(value) % 1 !== 0) throw new Error(`Non-power-of-two permission bit: ${key}`);
		used.add(value);
	}
}

export type Pair<K, V> = [K, V];

//#endregion
