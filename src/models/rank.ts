import {
	CreationOptional,
	DataTypes,
	ForeignKey,
	HasManyGetAssociationsMixin,
	HasOneGetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, HasMany, HasOne, Table } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
import { RankUsage } from './rankUsage.js';
import { User } from './user.js';

export enum RankAssociations {
	RankUsage = 'rankUsage',
	SecondaryUsers = 'secondaryUsers',
}

export class Rank extends Model<InferAttributes<Rank>, InferCreationAttributes<Rank>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare rankId: CreationOptional<number>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: ForeignKey<Guild['guildId']>;

	@Attribute({ type: DataTypes.STRING(100), allowNull: false })
	declare name: string;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false, unique: true })
	declare roleId: string;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare pointsRequired: number;

	@Attribute({ type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 })
	declare userLimit: number;

	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false })
	declare stackable: boolean;

	@HasOne(() => RankUsage, { foreignKey: { name: 'rankId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare rankUsage?: NonAttribute<RankUsage>;
	declare getRankUsage: HasOneGetAssociationMixin<RankUsage>;

	/** Associated in {@link User} */
	declare secondaryUsers?: NonAttribute<User[]>;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
