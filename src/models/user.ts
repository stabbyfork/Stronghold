import {
	BelongsToGetAssociationMixin,
	BelongsToManyAddAssociationMixin,
	BelongsToManyAddAssociationsMixin,
	BelongsToManyGetAssociationsMixin,
	BelongsToManyHasAssociationMixin,
	BelongsToManyRemoveAssociationMixin,
	BelongsToManyRemoveAssociationsMixin,
	BelongsToManySetAssociationsMixin,
	BelongsToSetAssociationMixin,
	CreationOptional,
	DataTypes,
	ForeignKey,
	HasOneCreateAssociationMixin,
	HasOneGetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { Guild } from './guild.js';
import { Rank } from './rank.js';
import { RoleGroup } from './roleGroup.js';
import { UserPermission } from './userPermission.js';

export enum UserAssociations {
	UserPermission = 'userPermission',
	SecondaryRanks = 'ranks',
	NextRank = 'nextRank',
	MainRank = 'mainRank',
	RoleGroups = 'roleGroups',
}

/** Per guild */
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
	declare id: CreationOptional<number>;
	declare guildId: ForeignKey<Guild['guildId']>;

	declare userId: string;

	declare points: CreationOptional<number>;

	declare inactivityStrikes: CreationOptional<number>;

	declare mainRankId: number | null;

	declare nextRankId: number | null;

	declare userPermission?: NonAttribute<UserPermission>;

	declare getUserPermission: HasOneGetAssociationMixin<UserPermission>;
	declare createUserPermission: HasOneCreateAssociationMixin<UserPermission>;

	/** The main unstackable rank */
	declare mainRank?: NonAttribute<Rank | null>;
	declare getMainRank: BelongsToGetAssociationMixin<Rank>;
	declare setMainRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	/** Secondary stackable ranks */
	declare ranks?: NonAttribute<Rank[]>;
	declare getRanks: BelongsToManyGetAssociationsMixin<Rank>;
	declare setRanks: BelongsToManySetAssociationsMixin<Rank, Rank['rankId']>;
	declare addRanks: BelongsToManyAddAssociationsMixin<Rank, Rank['rankId']>;
	declare removeRanks: BelongsToManyRemoveAssociationsMixin<Rank, Rank['rankId']>;

	/** Next main unstackable rank */
	declare nextRank?: NonAttribute<Rank | null>;
	declare getNextRank: BelongsToGetAssociationMixin<Rank>;
	declare setNextRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	declare roleGroups: NonAttribute<RoleGroup[]>;

	declare addRoleGroup: BelongsToManyAddAssociationMixin<RoleGroup, RoleGroup['id']>;
	declare removeRoleGroup: BelongsToManyRemoveAssociationMixin<RoleGroup, RoleGroup['id']>;
	declare hasRoleGroup: BelongsToManyHasAssociationMixin<RoleGroup, RoleGroup['id']>;

	/** Whether the user can see ads in this guild */
	declare adsEnabled: CreationOptional<boolean>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize) {
	User.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			userId: { type: DataTypes.STRING(20), allowNull: false },
			points: { type: DataTypes.INTEGER, defaultValue: 0 },
			inactivityStrikes: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
			mainRankId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			nextRankId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			adsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
			createdAt: { type: DataTypes.DATE },
			updatedAt: { type: DataTypes.DATE },
		},
		{
			sequelize,
			modelName: 'User',
			tableName: 'Users',
			indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
		},
	);

	User.hasOne(UserPermission, { as: UserAssociations.UserPermission, foreignKey: 'userId' });
	User.belongsTo(Rank, { as: UserAssociations.MainRank, foreignKey: 'mainRankId' });
	User.belongsToMany(Rank, { as: UserAssociations.SecondaryRanks, through: 'UserRanks' });
	User.belongsTo(Rank, { as: UserAssociations.NextRank, foreignKey: 'nextRankId' });
	User.belongsToMany(RoleGroup, { as: UserAssociations.RoleGroups, through: 'UserRoleGroups' });
}
