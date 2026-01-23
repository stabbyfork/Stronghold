import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';

export class RoleData extends Model<InferAttributes<RoleData>, InferCreationAttributes<RoleData>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	/** Associated in {@link Guild} */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false, unique: true })
	declare roleId: string;

	/** Associated in {@link RoleGroup} */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare groupId: number | null;

	@Attribute({ type: DataTypes.STRING(16), allowNull: true })
	declare prefix: string | null;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
