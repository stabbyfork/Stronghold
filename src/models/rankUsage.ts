import {
	Association,
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NormalizedAssociationOptions,
} from '@sequelize/core';
import { Attribute } from '@sequelize/core/decorators-legacy';
export class RankUsage extends Model<InferAttributes<RankUsage>, InferCreationAttributes<RankUsage>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true })
	declare rankId: number;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 })
	declare userCount: number;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
