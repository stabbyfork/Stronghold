import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, BelongsToMany, Table } from '@sequelize/core/decorators-legacy';
import { RoleGroup } from './roleGroup.js';

@Table({ indexes: [{ fields: ['guildId', 'roleId'] }] })
export class RoleData extends Model<InferAttributes<RoleData>, InferCreationAttributes<RoleData>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	/** Associated in {@link Guild} */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false, unique: true })
	declare roleId: string;

	@BelongsToMany(() => RoleGroup, {
		through: 'RoleGroupRoles',
		inverse: 'roles',
	})
	declare roleGroups?: NonAttribute<RoleGroup[]>;

	declare getRoleGroups: BelongsToManyGetAssociationsMixin<RoleGroup>;
	declare addRoleGroup: BelongsToManyAddAssociationMixin<RoleGroup, RoleGroup['id']>;

	@Attribute({ type: DataTypes.STRING(16), allowNull: true })
	declare prefix: string | null;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
