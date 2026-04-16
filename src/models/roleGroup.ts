import {
	CreationOptional,
	DataTypes,
	HasManySetAssociationsMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { RoleData } from './roleData.js';
import { User } from './user.js';

export enum RoleGroupAssociations {
	Roles = 'roles',
	Users = 'users',
}

export class RoleGroup extends Model<InferAttributes<RoleGroup>, InferCreationAttributes<RoleGroup>> {
	declare id: CreationOptional<number>;

	/** Associated in {@link Guild} */
	declare guildId: string;

	declare name: string;

	declare joinable: boolean;

	declare joinNeedsApproval: boolean;

	/** Associated in {@link RoleData} */
	declare roles?: NonAttribute<RoleData[]>;

	declare setRoles: HasManySetAssociationsMixin<RoleData, RoleData['id']>;

	/** Associated in {@link User} */
	declare users?: NonAttribute<User[]>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRoleGroupModel(sequelize: Sequelize) {
	RoleGroup.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			name: { type: DataTypes.STRING(32), allowNull: false },
			joinable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			joinNeedsApproval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'RoleGroup',
			indexes: [{ unique: true, fields: ['guildId', 'name'] }],
		},
	);

	RoleGroup.belongsToMany(User, { as: RoleGroupAssociations.Users, through: 'UserRoleGroups' });
	RoleGroup.belongsToMany(RoleData, { as: RoleGroupAssociations.Roles, through: 'RoleGroupRoles' });
}
