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
	Sequelize,
} from 'sequelize';
import { Guild } from './guild.js';
import { RankUsage } from './rankUsage.js';
import { User } from './user.js';

export enum RankAssociations {
	RankUsage = 'rankUsage',
	SecondaryUsers = 'secondaryUsers',
}

export class Rank extends Model<InferAttributes<Rank>, InferCreationAttributes<Rank>> {
	declare rankId: CreationOptional<number>;

	declare guildId: ForeignKey<Guild['guildId']>;

	declare name: string;

	declare roleId: string;

	declare pointsRequired: number;

	declare userLimit: number;

	declare stackable: boolean;

	declare showInRanking: boolean;

	declare rankUsage?: NonAttribute<RankUsage>;
	declare getRankUsage: HasOneGetAssociationMixin<RankUsage>;

	/** Associated in {@link User} */
	declare secondaryUsers?: NonAttribute<User[]>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRankModel(sequelize: Sequelize) {
	Rank.init(
		{
			rankId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			name: { type: DataTypes.STRING(100), allowNull: false },
			roleId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
			pointsRequired: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			userLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 },
			stackable: { type: DataTypes.BOOLEAN, allowNull: false },
			showInRanking: { type: DataTypes.BOOLEAN, allowNull: false },
			createdAt: { type: DataTypes.DATE },
			updatedAt: { type: DataTypes.DATE },
		},
		{ sequelize, modelName: 'Rank' },
	);

	Rank.hasOne(RankUsage, { as: RankAssociations.RankUsage, foreignKey: 'rankId' });
	Rank.belongsToMany(User, { as: RankAssociations.SecondaryUsers, through: 'UserRanks' });
}
