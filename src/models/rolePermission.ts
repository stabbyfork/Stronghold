import { CreationOptional, DataTypes, ForeignKey, InferCreationAttributes, Model } from '@sequelize/core';
import { Attribute } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
export class RolePermission extends Model<RolePermission, InferCreationAttributes<RolePermission>> {
	@Attribute({ type: DataTypes.STRING(20), primaryKey: true })
	declare guildId: ForeignKey<Guild['guildId']>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare roleId: string;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare permissions: number;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
