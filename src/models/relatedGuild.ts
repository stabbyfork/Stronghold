import {
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, BelongsTo, Table } from '@sequelize/core/decorators-legacy';
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

@Table({ indexes: [{ unique: true, fields: ['guildId', 'targetGuildId'] }] })
export class RelatedGuild extends Model<InferAttributes<RelatedGuild>, InferCreationAttributes<RelatedGuild>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	/** Associated in {@link Guild} */
	declare guild?: NonAttribute<Guild>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare targetGuildId: string;

	@BelongsTo(() => Guild, 'targetGuildId')
	declare targetGuild?: NonAttribute<Guild>;

	@Attribute({ type: DataTypes.ENUM(GuildRelation), allowNull: true })
	declare relation: GuildRelation | null;

	@Attribute({ type: DataTypes.STRING(20), allowNull: true, unique: true })
	declare targetThreadId: string | null;

	@Attribute({ type: DataTypes.STRING(20), allowNull: true, unique: true })
	declare sourceThreadId: string | null;

	@Attribute({ type: DataTypes.ENUM(GuildRelation), allowNull: true })
	declare activeChange: GuildRelation | null;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
