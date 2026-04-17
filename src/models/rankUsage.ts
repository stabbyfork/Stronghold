import { CreationOptional, DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from 'sequelize';
export class RankUsage extends Model<InferAttributes<RankUsage>, InferCreationAttributes<RankUsage>> {
	declare rankId: number;

	declare userCount: number;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initRankUsageModel(sequelize: Sequelize) {
	RankUsage.init(
		{
			rankId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
			userCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{ sequelize, modelName: 'RankUsage' },
	);
	return () => {};
}
