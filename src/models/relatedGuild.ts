import {
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { Guild } from './guild.js';

export enum GuildRelation {
	Ally = 'Ally',
	Enemy = 'Enemy',
	Neutral = 'Neutral',
}

export enum RelatedGuildAssociations {
	TargetGuild = 'targetGuild',
	Guild = 'guild',
}

export class RelatedGuild extends Model<InferAttributes<RelatedGuild>, InferCreationAttributes<RelatedGuild>> {
	declare id: CreationOptional<number>;

	declare guildId: string;

	/** Associated in {@link Guild} */
	declare guild?: NonAttribute<Guild>;

	declare targetGuildId: string;

	declare targetGuild?: NonAttribute<Guild>;

	declare relation: GuildRelation | null;

	declare targetThreadId: string | null;

	declare sourceThreadId: string | null;

	declare activeChange: GuildRelation | null;

	declare createdAt: CreationOptional<Date>;

	declare updatedAt: CreationOptional<Date>;
}

export function initRelatedGuildModel(sequelize: Sequelize) {
	RelatedGuild.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			targetGuildId: { type: DataTypes.STRING(20), allowNull: false },
			relation: { type: DataTypes.ENUM(...Object.values(GuildRelation)), allowNull: true },
			targetThreadId: { type: DataTypes.STRING(20), allowNull: true, unique: true },
			sourceThreadId: { type: DataTypes.STRING(20), allowNull: true, unique: true },
			activeChange: { type: DataTypes.ENUM(...Object.values(GuildRelation)), allowNull: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'RelatedGuild',
			indexes: [{ unique: true, fields: ['guildId', 'targetGuildId'] }],
		},
	);

	RelatedGuild.belongsTo(Guild, { as: RelatedGuildAssociations.TargetGuild, foreignKey: 'targetGuildId' });
	RelatedGuild.belongsTo(Guild, { as: RelatedGuildAssociations.Guild, foreignKey: 'guildId' });
}
