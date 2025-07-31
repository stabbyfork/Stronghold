export enum Permission {
	Administrator = 'administrator',
	NoActivityKick = 'noActivityKick',
}
/**
 * Index using {@link Permission}
 */
export const PermissionBits = {
	[Permission.Administrator]: 0b1,
	[Permission.NoActivityKick]: 0b10,
} as const satisfies { [K in Permission]: number };

const _used = new Set();
for (const key in PermissionBits) {
	if (_used.has(PermissionBits[key as Permission])) throw new Error(`Duplicate permission bit: ${key}`);
	if (Number.isNaN(PermissionBits[key as Permission])) throw new Error(`NaN permission bit: ${key}`);
	if (!Number.isInteger(PermissionBits[key as Permission])) throw new Error(`Non-integer permission bit: ${key}`);
	if (PermissionBits[key as Permission] <= 0) throw new Error(`Negative or zero permission bit: ${key}`);
	_used.add(PermissionBits[key as Permission]);
}
