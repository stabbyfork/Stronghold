import {
	BelongsToGetAssociationMixin,
	CreationOptional,
	DataTypes,
	ForeignKey,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { Guild } from './guild.js';
import { User } from './user.js';

export enum UserPermissionAssociations {
	User = 'user',
}

export class UserPermission extends Model<InferAttributes<UserPermission>, InferCreationAttributes<UserPermission>> {
	declare id: CreationOptional<number>;

	declare guildId: ForeignKey<Guild['guildId']>;

	/** Internal database ID */
	declare userId: ForeignKey<User['id']>;

	declare permissions: number;

	/** Associated in {@link User} */
	declare user?: NonAttribute<User>;

	declare getUser: BelongsToGetAssociationMixin<User>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initUserPermissionModel(sequelize: Sequelize) {
	UserPermission.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			permissions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'UserPermission',
			indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
		},
	);
	return () => {
		UserPermission.belongsTo(User, { as: UserPermissionAssociations.User, foreignKey: 'userId' });
	};
}
