import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';

// TODO: Migrate to RobloxUser, find user ID from Roblox username
// /rbx blacklist add/remove/clear/list/find
// TODO: Add Convenience commands that combine multiple commands
@Table({ indexes: [{ unique: true, fields: ['guildId', 'username'] }] })
export class BlacklistedUser extends Model<InferAttributes<BlacklistedUser>, InferCreationAttributes<BlacklistedUser>> {
	@Attribute({ primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER.UNSIGNED })
	declare id: CreationOptional<number>;

	/** Associated in Guild.ts */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(50), allowNull: false })
	declare username: string;

	@Attribute({ type: DataTypes.STRING(128), allowNull: true })
	declare blacklistReason: string | null;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
