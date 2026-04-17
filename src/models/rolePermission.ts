import {
	CreationOptional,
	DataTypes,
	ForeignKey,
	Model,
	Sequelize,
	InferAttributes,
	InferCreationAttributes,
} from 'sequelize';
import { Guild } from './guild.js';
export class RolePermission extends Model<InferAttributes<RolePermission>, InferCreationAttributes<RolePermission>> {
	declare guildId: ForeignKey<Guild['guildId']>;

	declare roleId: string;

	declare permissions: number;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRolePermissionModel(sequelize: Sequelize) {
	RolePermission.init(
		{
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			roleId: { type: DataTypes.STRING(20), allowNull: false },
			permissions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'RolePermission',
			indexes: [{ unique: true, fields: ['guildId', 'roleId'] }],
		},
	);
	return () => {};
}
