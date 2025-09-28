import {
	BelongsToGetAssociationMixin,
	CreationOptional,
	DataTypes,
	ForeignKey,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, BelongsTo, Table } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
import { User } from './user.js';

export enum UserPermissionAssociations {
	User = 'user',
}

@Table({ indexes: [{ unique: true, fields: ['guildId', 'userId'] }] })
export class UserPermission extends Model<InferAttributes<UserPermission>, InferCreationAttributes<UserPermission>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: ForeignKey<Guild['guildId']>;

	/** Internal database ID */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare userId: ForeignKey<User['id']>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare permissions: number;

	/** Associated in {@link User} */
	declare user?: NonAttribute<User>;

	declare getUser: BelongsToGetAssociationMixin<User>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
