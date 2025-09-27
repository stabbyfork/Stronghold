//#region Generics

/**
 * Recursively gets all values of a given object.
 *
 * This type takes a given object and recursively gets all values of the object.
 * If the object is not a record, it is returned as-is.
 *
 * @example
 * // Given: { a: { b: { c: 1 } } }
 * // Returns: 1
 * @example
 * // Given: { a: 1, b: { c: 2 } }
 * // Returns: 1 | 2
 *
 * @param T The object to get the values of.
 * @returns The values of the object.
 */
export type RecursiveFlatVals<T> =
	T extends Record<string, any> ? { [K in keyof T]: RecursiveFlatVals<T[K]> }[keyof T] : T;
/**
 * Recursively gets all keys of a given object.
 *
 * This type takes a given object and recursively gets all keys of the object.
 * If the object is not a record, it is returned as `never`.
 *
 * @example
 * // Given: { a: { b: { c: 1 } } }
 * // Returns: 'a' | 'b' | 'c'
 * @example
 * // Given: { a: 1, b: { c: 2 } }
 * // Returns: 'a' | 'b' | 'c'
 *
 * @param T The object to get the keys of.
 * @returns The keys of the object.
 */
export type RecursiveFlatKeys<T> =
	T extends Record<string, any> ? { [K in keyof T]: K | RecursiveFlatKeys<T[K]> }[keyof T] : never;

export type ValueOf<T> = T[keyof T];
export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? RecursivePartial<U>[]
		: T[P] extends object | undefined
			? RecursivePartial<T[P]>
			: T[P];
};

//#endregion
