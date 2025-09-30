import {
	CreationOptional,
	DataTypes,
	HasManyAddAssociationMixin,
	HasManyCreateAssociationMixin,
	HasManyHasAssociationMixin,
	HasManyRemoveAssociationMixin,
	HasManySetAssociationsMixin,
	HasOneCreateAssociationMixin,
	HasOneGetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, HasMany, HasOne } from '@sequelize/core/decorators-legacy';
import { SessionOptions } from './sessionOptions.js';
import { User } from './user.js';

export enum GuildSessionAssociations {
	DefaultOptions = 'defaultOptions',
	TotalUsers = 'totalUsers',
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
	@Attribute({ type: DataTypes.STRING(64), allowNull: false })
	declare title: string;

	@Attribute({ type: DataTypes.STRING(256), allowNull: false })
	declare message: string;

	@HasOne(() => SessionOptions, { foreignKey: { name: 'id', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare defaultOptions?: NonAttribute<SessionOptions>;
	declare createDefaultOptions: HasOneCreateAssociationMixin<SessionOptions, 'sessionId'>;
	declare getDefaultOptions: HasOneGetAssociationMixin<SessionOptions>;

	/** Users that have ever joined (even if currently not in) this session */
	@HasMany(() => User, { foreignKey: { name: 'sessionId', onUpdate: 'CASCADE', onDelete: 'SET NULL' } })
	declare totalUsers?: NonAttribute<User[]>;

	declare createTotalUser: HasManyCreateAssociationMixin<User, 'sessionId'>;
	declare addTotalUser: HasManyAddAssociationMixin<User, User['id']>;
	declare hasTotalUser: HasManyHasAssociationMixin<User, User['id']>;
	declare removeTotalUser: HasManyRemoveAssociationMixin<User, User['id']>;
	declare setTotalUsers: HasManySetAssociationsMixin<User, User['id']>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
