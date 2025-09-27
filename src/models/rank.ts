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
}

@Table({ indexes: [{ unique: true, fields: ['guildId', 'pointsRequired'] }] })
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

	@HasOne(() => RankUsage, 'rankId')
	declare rankUsage?: NonAttribute<RankUsage>;
	declare getRankUsage: HasOneGetAssociationMixin<RankUsage>;

	@HasMany(() => User, { foreignKey: 'rankId', inverse: 'rank' })
	declare users?: NonAttribute<User[]>;
	declare getUsers: HasManyGetAssociationsMixin<User>;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
