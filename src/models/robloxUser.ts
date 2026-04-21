import { CreationOptional, DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from 'sequelize';

// TODO: Migrate to RobloxUser, find user ID from Roblox username
// /rbx blacklist add/remove/clear/list/find
// TODO: Add Convenience commands that combine multiple commands
export class RobloxUser extends Model<InferAttributes<RobloxUser>, InferCreationAttributes<RobloxUser>> {
	declare id: CreationOptional<number>;

	/** Associated in Guild.ts */
	declare guildId: string;

	/** Roblox user ID */
	declare userId: string;

	declare points: CreationOptional<number>;

	declare inSession: CreationOptional<boolean>;

	declare blacklisted: CreationOptional<boolean>;
	declare blacklistReason: string | null;
	/** Discord user ID of who blacklisted them */
	declare blacklister: string | null;
	/** Time when the user was blacklisted */
	declare blacklistTime: Date | null;
	/** Duration of the blacklist in seconds, or null if permanent or not blacklisted */
	declare blacklistDuration: number | null;
	declare blacklistExpiresAt: Date | null;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRobloxUserModel(sequelize: Sequelize) {
	RobloxUser.init(
		{
			id: { primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER.UNSIGNED },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			userId: { type: DataTypes.STRING(20), allowNull: false },
			points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			inSession: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			blacklisted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			blacklistReason: { type: DataTypes.STRING(128), allowNull: true },
			blacklister: { type: DataTypes.STRING(20), allowNull: true },
			blacklistTime: { type: DataTypes.DATE, allowNull: true },
			blacklistDuration: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
			blacklistExpiresAt: { type: DataTypes.DATE, allowNull: true },
			createdAt: { type: DataTypes.DATE },
			updatedAt: { type: DataTypes.DATE },
		},
		{
			sequelize,
			modelName: 'RobloxUser',
			indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
		},
	);
	return () => {};
}
