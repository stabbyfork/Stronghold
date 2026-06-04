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

export function delayFor(timeInMillis: number): Promise<void> {
	return new Promise((resolve) => setTimeout(() => resolve(), timeInMillis));
}

/**
 * A Map-based FIFO queue data structure that allows for multiple queues identified by keys.
 * NOT THREAD-SAFE
 * @typeParam K - The type of the keys used to identify different queues.
 * @typeParam V - The type of the values stored in the queues.
 */
export class MapQueue<K, V> {
	private map = new Map<K, V[]>();
	private highestIndex = new Map<K, number>();
	private lowestIndex = new Map<K, number>();
	/** A set of keys that are currently locked (no read/write) */
	private lockBits = new Set<K>();
	/** A map of listeners for when values are removed from the queues, return true to disconnect the listener */
	private removalListeners = new Map<K, ((val: V | undefined) => boolean)[]>();
	/** FIFO order of keys */
	private keyOrder = [] as K[];

	/**
	 * Adds a value to the end of the queue identified by the given key.
	 * If the queue does not exist, it is created.
	 * @param key - The key identifying the queue to which the value should be added.
	 * @param value - The value to add to the queue.
	 */
	push(key: K, value: V) {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot push to queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		if (!this.map.has(key)) {
			this.map.set(key, []);
		}
		this.map.get(key)!.push(value);
		this.highestIndex.set(key, (this.highestIndex.get(key) ?? -1) + 1);
		if (!this.lowestIndex.has(key)) {
			this.lowestIndex.set(key, 0);
		}
		this.keyOrder.push(key);
		this.lockBits.delete(key);
	}

	/**
	 * Removes and returns the value at the front of the queue identified by the given key.
	 * If the queue is empty or does not exist, it returns `undefined`.
	 * @param key - The key identifying the queue from which to remove the value.
	 * @returns The value at the front of the queue, or `undefined` if the queue is empty or does not exist.
	 */
	popFirst(key: K): V | undefined {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot pop from queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		const queue = this.map.get(key);
		if (!queue || queue.length === 0) {
			this.lockBits.delete(key);
			return undefined;
		}
		const value = queue.shift();
		this.highestIndex.set(key, (this.highestIndex.get(key) ?? -1) - 1);

		const awaiting = this.removalListeners.get(key);
		if (awaiting && awaiting.length > 0) {
			for (let i = awaiting.length - 1; i >= 0; i--) {
				if (awaiting[i](value)) {
					awaiting.splice(i, 1);
				}
			}
		}
		this.keyOrder.splice(this.keyOrder.indexOf(key), 1);
		this.lockBits.delete(key);
		return value;
	}

	/**
	 * Removes and returns the value at the end of the queue identified by the given key.
	 * If the queue is empty or does not exist, it returns `undefined`.
	 * @param key - The key identifying the queue from which to remove the value.
	 * @returns The value at the end of the queue, or `undefined` if the queue is empty or does not exist.
	 */
	popLast(key: K): V | undefined {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot pop from queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		const queue = this.map.get(key);
		if (!queue || queue.length === 0) {
			this.lockBits.delete(key);
			return undefined;
		}
		this.highestIndex.set(key, (this.highestIndex.get(key) ?? -1) - 1);
		const value = queue.pop();
		const awaiting = this.removalListeners.get(key);
		if (awaiting && awaiting.length > 0) {
			for (let i = awaiting.length - 1; i >= 0; i--) {
				if (awaiting[i](value)) {
					awaiting.splice(i, 1);
				}
			}
		}
		this.keyOrder.splice(this.keyOrder.indexOf(key), 1);
		this.lockBits.delete(key);
		return value;
	}

	/**
	 * Returns a promise that resolves with the value of the next removed item from the queue identified by the given key.
	 * @param key - The key identifying the queue to await a removal from.
	 * @returns A promise that resolves with the value of the next removed item from the queue, or `undefined` if the queue is empty when the removal occurs.
	 */
	awaitRemove(key: K, once: boolean): Promise<V | undefined> {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot await remove from queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		const promise = Promise.withResolvers<V | undefined>();
		this.removalListeners.set(key, [
			...(this.removalListeners.get(key) ?? []),
			(val) => {
				promise.resolve(val);
				return once;
			},
		]);
		this.lockBits.delete(key);
		return promise.promise;
	}

	/**
	 * Adds a listener function that will be called whenever a value is removed from the queue identified by the given key.
	 * The listener function receives the removed value as an argument and should return `true` if it should be removed after being called, or `false` to keep it.
	 * @param key - The key identifying the queue to which the listener should be added.
	 * @param listener - The listener function to add, which will be called with the removed value whenever a value is removed from the queue.
	 */
	addRemoveListener(key: K, listener: (val: V | undefined) => boolean) {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot add listener to queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		this.removalListeners.set(key, [...(this.removalListeners.get(key) ?? []), listener]);
		this.lockBits.delete(key);
	}

	/**
	 * Removes a listener function from the list of listeners for the queue identified by the given key.
	 * @param key - The key identifying the queue from which to remove the listener.
	 * @param listener - The listener function to remove.
	 * @returns `true` if the listener was found and removed, `false` otherwise.
	 */
	removeRemoveListener(key: K, listener: (val: V | undefined) => boolean): boolean {
		if (this.lockBits.has(key)) {
			throw new Error(`Cannot remove listener from queue with key ${key} because it is locked`);
		}
		this.lockBits.add(key);
		const listeners = this.removalListeners.get(key);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index !== -1) {
				listeners.splice(index, 1);
				this.lockBits.delete(key);
				return true;
			}
		}
		this.lockBits.delete(key);
		return false;
	}

	popFirstKeyPair(): [K, V] | undefined {
		if (this.keyOrder.length === 0) return undefined;
		const key = this.keyOrder[0];
		const value = this.popFirst(key);
		if (value === undefined) return undefined;
		return [key, value];
	}

	get keySize() {
		return this.keyOrder.length;
	}

	get size() {
		let size = 0;
		for (const queue of this.map.values()) {
			size += queue.length;
		}
		return size;
	}
}

//#endregion
