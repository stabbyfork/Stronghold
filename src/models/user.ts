import {
	Association,
	BelongsToGetAssociationMixin,
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
	NormalizedAssociationOptions,
} from '@sequelize/core';
import { Guild } from './guild.js';
import { Rank } from './rank.js';
import { Attribute, BelongsTo, BelongsToMany, HasMany, HasOne, Table } from '@sequelize/core/decorators-legacy';
import { UserPermission } from './userPermission.js';

export enum UserAssociations {
	Guilds = 'guilds',
	UserPermissions = 'userPermissions',
	Rank = 'rank',
	NextRank = 'nextRank',
}

/** Per guild */
@Table({
	indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
})
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: ForeignKey<Guild['guildId']>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare userId: string;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 })
	declare points: CreationOptional<number>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 })
	declare inactivityStrikes: CreationOptional<number>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare rankId: number | null;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare nextRankId: number | null;

	@HasOne(() => UserPermission, { foreignKey: 'userId', inverse: 'user' })
	declare userPermission?: UserPermission;

	declare getUserPermission: HasOneGetAssociationMixin<UserPermission>;
	declare createUserPermission: HasOneCreateAssociationMixin<UserPermission, 'userId'>;

	@BelongsToMany(() => Guild, {
		through: 'UserGuild',
		inverse: 'users',
	})
	declare guilds?: NonAttribute<Guild[]>;

	/** Associated in {@link Rank} */
	declare rank?: NonAttribute<Rank | null>;
	declare getRank: BelongsToGetAssociationMixin<Rank>;
	declare setRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	@BelongsTo(() => Rank, { foreignKey: { name: 'nextRankId', allowNull: true } })
	declare nextRank?: NonAttribute<Rank | null>;
	declare getNextRank: BelongsToGetAssociationMixin<Rank>;
	declare setNextRank: BelongsToSetAssociationMixin<Rank, Rank['rankId']>;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
