import {
	CreationOptional,
	DataTypes,
	HasManySetAssociationsMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';
import { RoleData } from './roleData.js';
import { User } from './user.js';

export enum RoleGroupAssociations {
	Roles = 'roles',
	Users = 'users',
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

	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
	declare joinable: boolean;

	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true })
	declare joinNeedsApproval: boolean;

	/** Associated in {@link RoleData} */
	declare roles?: NonAttribute<RoleData[]>;

	declare setRoles: HasManySetAssociationsMixin<RoleData, RoleData['id']>;

	/** Associated in {@link User} */
	declare users?: NonAttribute<User[]>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
