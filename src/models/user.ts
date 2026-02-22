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
} from '@sequelize/core';
import { Attribute, BelongsTo, BelongsToMany, HasOne, Table } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
import { Rank } from './rank.js';
import { RoleGroup } from './roleGroup.js';
import { UserPermission } from './userPermission.js';

export enum UserAssociations {
	Guilds = 'guilds',
	UserPermission = 'userPermission',
	SecondaryRanks = 'ranks',
	NextRank = 'nextRank',
	MainRank = 'mainRank',
	RoleGroups = 'roleGroups',
}

/** Per guild */
@Table({
	indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
	tableName: 'Users',
})
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: ForeignKey<Guild['guildId']>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare userId: string;

	@Attribute({ type: DataTypes.INTEGER, defaultValue: 0 })
	declare points: CreationOptional<number>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 })
	declare inactivityStrikes: CreationOptional<number>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare mainRankId: number | null;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare nextRankId: number | null;

	@HasOne(() => UserPermission, { foreignKey: 'userId', inverse: 'user' })
	declare userPermission?: NonAttribute<UserPermission>;

	declare getUserPermission: HasOneGetAssociationMixin<UserPermission>;
	declare createUserPermission: HasOneCreateAssociationMixin<UserPermission, 'userId'>;

	@BelongsToMany(() => Guild, {
		through: 'UserGuilds',
		inverse: 'users',
	})
	declare guilds?: NonAttribute<Guild[]>;

	/** The main unstackable rank */
	@BelongsTo(() => Rank, { foreignKey: { name: 'mainRankId', allowNull: true } })
	declare mainRank?: NonAttribute<Rank | null>;
	declare getMainRank: BelongsToGetAssociationMixin<Rank>;
	declare setMainRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	/** Secondary stackable ranks */
	@BelongsToMany(() => Rank, { through: 'UserRanks', inverse: 'secondaryUsers' })
	declare ranks?: NonAttribute<Rank[]>;
	declare getRanks: BelongsToManyGetAssociationsMixin<Rank>;
	declare setRanks: BelongsToManySetAssociationsMixin<Rank, Rank['rankId']>;
	declare addRanks: BelongsToManyAddAssociationsMixin<Rank, Rank['rankId']>;
	declare removeRanks: BelongsToManyRemoveAssociationsMixin<Rank, Rank['rankId']>;

	/** Next main unstackable rank */
	@BelongsTo(() => Rank, { foreignKey: { name: 'nextRankId', allowNull: true } })
	declare nextRank?: NonAttribute<Rank | null>;
	declare getNextRank: BelongsToGetAssociationMixin<Rank>;
	declare setNextRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	@BelongsToMany(() => RoleGroup, { through: 'UserRoleGroups', inverse: 'users' })
	declare roleGroups: NonAttribute<RoleGroup[]>;

	declare addRoleGroup: BelongsToManyAddAssociationMixin<RoleGroup, RoleGroup['id']>;
	declare removeRoleGroup: BelongsToManyRemoveAssociationMixin<RoleGroup, RoleGroup['id']>;
	declare hasRoleGroup: BelongsToManyHasAssociationMixin<RoleGroup, RoleGroup['id']>;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
