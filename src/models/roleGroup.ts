import {
	CreationOptional,
	DataTypes,
	HasManySetAssociationsMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, BelongsTo, BelongsToMany, HasMany, Table } from '@sequelize/core/decorators-legacy';
import { RoleData } from './roleData.js';

export enum RoleGroupAssociations {
	Roles = 'roles',
}

@Table({ indexes: [{ unique: true, fields: ['guildId', 'name'] }] })
export class RoleGroup extends Model<InferAttributes<RoleGroup>, InferCreationAttributes<RoleGroup>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	/** Associated in {@link Guild} */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(32), allowNull: false })
	declare name: string;

	/** Associated in {@link RoleData} */
	declare roles?: NonAttribute<RoleData[]>;

	declare setRoles: HasManySetAssociationsMixin<RoleData, RoleData['id']>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
