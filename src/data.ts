import { Debug } from './utils.js';
import { Config } from './config.js';
import {
	Association,
	CreationOptional,
	DataTypes,
	ForeignKey,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';

//const cacheDb = new Sequelize('sqlite::memory:');
const dbConfg = Config.get('database');
const remoteDb = new Sequelize({
	password: dbConfg.password,
	username: dbConfg.username,
	database: dbConfg.name,
	host: dbConfg.host,
	dialect: dbConfg.dialect,
	logging: false,
});

namespace Tables {
	export class Guild extends Model<
		InferAttributes<Guild, { omit: 'userPermissions' | 'rolePermissions' }>,
		InferCreationAttributes<Guild, { omit: 'userPermissions' | 'rolePermissions' }>
	> {
		declare guildId: string;
		declare ready: boolean;
		declare userPermissions?: NonAttribute<UserPermissions[]>;
		declare rolePermissions?: NonAttribute<RolePermissions[]>;

		declare createdAt: CreationOptional<Date>;
		declare updatedAt: CreationOptional<Date>;
		declare static associations: {
			userPermissions: Association<Guild, UserPermissions>;
			rolePermissions: Association<Guild, RolePermissions>;
		};
	}
	export class UserPermissions extends Model<
		InferAttributes<UserPermissions>,
		InferCreationAttributes<UserPermissions>
	> {
		declare id: CreationOptional<number>;
		declare guildId: ForeignKey<Guild['guildId']>;
		declare userId: string;
		declare permissions: number;

		declare createdAt: CreationOptional<Date>;
		declare updatedAt: CreationOptional<Date>;
	}
	export class RolePermissions extends Model<
		InferAttributes<RolePermissions>,
		InferCreationAttributes<RolePermissions>
	> {
		declare id: CreationOptional<number>;
		declare guildId: ForeignKey<Guild['guildId']>;
		declare roleId: string;
		declare permissions: number;

		declare createdAt: CreationOptional<Date>;
		declare updatedAt: CreationOptional<Date>;
	}
}

// TODO: Use getters to use a cache instead of in-memory DB
function createTables(sequelize: Sequelize) {
	const Guild = Tables.Guild.init(
		{
			guildId: {
				type: DataTypes.STRING(20),
				primaryKey: true,
			},
			ready: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'guilds',
			paranoid: true,
		},
	);
	const UserPermissions = Tables.UserPermissions.init(
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			guildId: {
				type: DataTypes.STRING(20),
				allowNull: false,
				unique: false,
			},
			userId: {
				type: DataTypes.STRING(20),
				allowNull: false,
				unique: true,
			},
			permissions: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'user_permissions',
		},
	);
	const RolePermissions = Tables.RolePermissions.init(
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			guildId: {
				type: DataTypes.STRING(20),
				allowNull: false,
				unique: false,
			},
			roleId: {
				type: DataTypes.STRING(20),
				allowNull: false,
				unique: true,
			},
			permissions: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'role_permissions',
		},
	);
	Guild.hasMany(UserPermissions, { foreignKey: 'guildId', sourceKey: 'guildId', as: 'userPermissions' });
	Guild.hasMany(RolePermissions, { foreignKey: 'guildId', sourceKey: 'guildId', as: 'rolePermissions' });
	return { Guild, UserPermissions, RolePermissions };
}

export namespace Data {
	let ready = false;

	//const cache = createTables(cacheDb);
	export const remoteModels = createTables(remoteDb);

	export async function setup() {
		if (ready) {
			Debug.error('Attempting to setup Data, which is already ready');
			return;
		}
		try {
			await remoteDb.authenticate();
			console.log('Database connections established successfully');
		} catch (error) {
			throw new Error(`Error while connecting to database: ${error}`);
		}

		await remoteDb.sync().catch((err) => {
			throw new Error(`Error while syncing database: ${err}`);
		});
		process.on('SIGTERM', handleShutdown);
		process.on('SIGINT', handleShutdown);
		ready = true;
	}

	/*export function setSaveInterval(seconds: number) {
		assert(
			seconds > 0 && Number.isInteger(seconds),
			'Invalid interval received, it must be above 0 and an integer',
		);
		intervalSeconds = seconds;
	}*/

	export function isReady() {
		return ready;
	}

	/*export async function get<
		T extends keyof typeof memModels,
		F extends (typeof memModels)[T][keyof (typeof memModels)[T]] &
			((args: any) => Promise<any>),
		P extends Parameters<F>,
		R extends Awaited<ReturnType<F>>,
	>(model: T, func: F, ...args: P): Promise<R | undefined> {
		if (!ready) return undefined;
		const result = await func(args);
		return result;
	}*/

	/*export function set(guildId: string, data: any) {
		if (!ready) return;
		data = { ...data, [guildId]: data };
		requireWrite = true;
	}*/

	/**
	 * Retrieves data from a specified local model and processes it with a callback function.
	 *
	 * @template M - The key of the local model to retrieve.
	 * @template R - The return type of the callback function.
	 *
	 * @param model - The name of the model to query.
	 * @param callback - A function that processes the model and returns a result.
	 *
	 * @returns A promise that resolves to the result of the callback function, or undefined if the data is not ready.
	 */
	/*export async function get<M extends keyof typeof localModels, R>(
		model: M,
		callback: (model: (typeof localModels)[M]) => Promise<R>,
	): Promise<R | undefined> {
		if (!ready) return undefined;
		return await callback(localModels[model]);
	}*/

	/**
	 * Modifies data in a specified local model using a callback function.
	 *
	 * @template M - The key of the local model to modify.
	 *
	 * @param model - The name of the model to modify.
	 * @param callback - A function that takes the model and modifies it. The function should return a promise that resolves when the modification is complete.
	 *
	 * @returns A promise that resolves when the callback function is complete, or undefined if the data is not ready.
	 */
	/*export async function set<M extends keyof typeof localModels>(
		model: M,
		callback: (model: (typeof localModels)[M]) => Promise<void>,
	) {
		if (!ready) return undefined;
		requireWrite = true;
		await callback(localModels[model]);
	}*/

	export function closeDb() {
		return remoteDb.close();
	}

	async function handleShutdown() {
		console.log('Saving data');
	}

	/*async function save() {
		if (!requireWrite) return;
		/*fs.writeFile('TODO', JSON.stringify(data, null, 4), (err) => {
			if (err)
				Debug.error(
					`Error while saving data at ${new Date().toUTCString()}:\n${err}`,
				);
		});
	}

	async function saveCycle() {
		for await (const _ of setInterval(intervalSeconds * 1000, undefined, {
			ref: false,
		})) {
			if (!doSave) return;
			save();
		}
	}*/
}
