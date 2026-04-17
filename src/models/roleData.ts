import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { RoleGroup } from './roleGroup.js';
import { Prefix } from '../utils/prefixUtils.js';

export enum RoleDataAssociations {
	RoleGroups = 'roleGroups',
}

export class RoleData extends Model<InferAttributes<RoleData>, InferCreationAttributes<RoleData>> {
	declare id: CreationOptional<number>;

	/** Associated in {@link Guild} */
	declare guildId: string;

	declare roleId: string;

	declare roleGroups?: NonAttribute<RoleGroup[]>;

	declare getRoleGroups: BelongsToManyGetAssociationsMixin<RoleGroup>;
	declare addRoleGroup: BelongsToManyAddAssociationMixin<RoleGroup, RoleGroup['id']>;

	declare prefix: string | null;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRoleDataModel(sequelize: Sequelize) {
	RoleData.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			roleId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
			prefix: { type: DataTypes.STRING(16), allowNull: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'RoleData',
			indexes: [{ fields: ['guildId', 'roleId'] }],
		},
	);
	return () => {
		RoleData.belongsToMany(RoleGroup, { as: RoleDataAssociations.RoleGroups, through: 'RoleGroupRoles' });

		RoleData.addHook('afterDestroy', async (roleData: RoleData) => {
			if (!roleData.prefix) return;
			const guildPrefixes = Prefix.prefixCache.get(roleData.guildId);
			if (!guildPrefixes) return;
			guildPrefixes.delete(roleData.roleId);
		});
	};
}
