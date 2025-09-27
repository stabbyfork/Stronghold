import {
	CreationOptional,
	DataTypes,
	HasOneCreateAssociationMixin,
	HasOneGetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, HasOne } from '@sequelize/core/decorators-legacy';
import { SessionOptions } from './sessionOptions.js';

export enum GuildSessionAssociations {
	DefaultOptions = 'defaultOptions',
}

export class GuildSession extends Model<InferAttributes<GuildSession>, InferCreationAttributes<GuildSession>> {
	@Attribute({ primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true })
	declare id: CreationOptional<string>;

	/** Associated in {@link Guild} */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare channelId: string;

	@Attribute({ type: DataTypes.DATE, allowNull: true })
	declare startedAt: Date | null;

	@Attribute({ type: DataTypes.DATE, allowNull: true })
	declare endedAt: Date | null;

	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false })
	declare active: boolean;

	@Attribute({ type: DataTypes.STRING(20), allowNull: true })
	declare sessionMessageId: string | null;

	/*@HasOne(() => SessionOptions, { foreignKey: { name: 'id', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare options?: NonAttribute<SessionOptions>;

	declare getOptions: HasOneGetAssociationMixin<SessionOptions>;
	declare createOptions: HasOneCreateAssociationMixin<SessionOptions, 'sessionId'>;*/

	@HasOne(() => SessionOptions, { foreignKey: { name: 'id', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare defaultOptions?: NonAttribute<SessionOptions>;
	declare createDefaultOptions: HasOneCreateAssociationMixin<SessionOptions, 'sessionId'>;
	declare getDefaultOptions: HasOneGetAssociationMixin<SessionOptions>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
