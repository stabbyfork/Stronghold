import {
	CreationOptional,
	DataTypes,
	ForeignKey,
	InferAttributes,
	InferCreationAttributes,
	Model,
} from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
@Table({ indexes: [{ unique: true, fields: ['guildId', 'roleId'] }] })
export class RolePermission extends Model<InferAttributes<RolePermission>, InferCreationAttributes<RolePermission>> {
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
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
