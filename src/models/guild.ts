import {
	CreationOptional,
	DataTypes,
	HasManyAddAssociationMixin,
	HasManyCreateAssociationMixin,
	HasManyGetAssociationsMixin,
	HasManyRemoveAssociationMixin,
	HasManyRemoveAssociationsMixin,
	HasOneGetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, HasMany, HasOne, Table, ValidateAttribute } from '@sequelize/core/decorators-legacy';
import { User } from './user.js';
import { ActivityCheck } from './activityCheck.js';
import { Rank } from './rank.js';
import { UserPermission } from './userPermission.js';
import { RolePermission } from './rolePermission.js';
import { GuildSession } from './session.js';
import { RelatedGuild } from './relatedGuild.js';
import { BlacklistedUser } from './blacklistedUser.js';

export enum GuildAssociations {
	Users = 'users',
	ActivityChecks = 'activityChecks',
	Ranks = 'ranks',
	UserPermissions = 'userPermissions',
	RolePermissions = 'rolePermissions',
	Session = 'session',
	RelatedGuilds = 'relatedGuilds',
	BlacklistedUsers = 'blacklistedUsers',
}

@Table({ tableName: 'Guilds' })
export class Guild extends Model<InferAttributes<Guild>, InferCreationAttributes<Guild>> {
	/** Internal ID */
	/*@Attribute({ autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER.UNSIGNED })
	declare id: number;*/
	/** Discord Guild ID */
	@Attribute({ primaryKey: true, type: DataTypes.STRING(20) })
	declare guildId: string;
	/** Ready status */
	@Attribute({ allowNull: false, type: DataTypes.BOOLEAN })
	declare ready: boolean;
	/** Bit flags for stuff to enable */
	@Attribute({ allowNull: false, defaultValue: 0, type: DataTypes.INTEGER.UNSIGNED })
	declare guildFlags: CreationOptional<number>;
	/** Log channel ID */
	@Attribute({ allowNull: true, type: DataTypes.STRING(20) })
	declare logChannelId: string | null;

	/** Diplomacy channel */
	@Attribute({ allowNull: true, type: DataTypes.STRING(20) })
	declare dpmChannelId: string | null;
	/** Selected game */
	@Attribute({ allowNull: true, type: DataTypes.STRING(100) })
	declare dpmGame: string | null;
	/**
	 * Invite URL to the server
	 * Only the second half (no discord.gg/)
	 * Overshoot 10 max characters for safety
	 * */
	@Attribute({ allowNull: true, type: DataTypes.STRING(12) })
	get serverInvite(): string | null {
		const code = this.getDataValue('serverInvite');
		if (!code) return null;
		return 'https://discord.gg/' + code;
	}
	/** Get invite URL */
	get serverUrl(): NonAttribute<string | null> {
		return this.getDataValue('serverInvite');
	}

	@Attribute({ allowNull: true, type: DataTypes.STRING(20) })
	declare inactiveRoleId: string | null;
	@Attribute({ allowNull: true, type: DataTypes.STRING(20) })
	declare inSessionRoleId: string | null;

	@Attribute({ allowNull: true, type: DataTypes.STRING(8), unique: true })
	@ValidateAttribute({
		isLowercase: true,
		notContains: [' ', '!'],
	})
	declare tag: string | null;

	/** Associated in user.ts */
	declare users?: NonAttribute<User[]>;

	@HasOne(() => ActivityCheck, { foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare activityCheck?: NonAttribute<ActivityCheck>;

	@HasMany(() => Rank, { foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare ranks?: NonAttribute<Rank[]>;

	@HasMany(() => UserPermission, {
		foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' },
	})
	declare userPermissions?: NonAttribute<UserPermission[]>;

	@HasMany(() => RolePermission, { foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare rolePermissions?: NonAttribute<RolePermission[]>;

	@HasOne(() => GuildSession, { foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare session?: NonAttribute<GuildSession>;
	declare getSession: HasOneGetAssociationMixin<GuildSession>;

	@HasMany(() => RelatedGuild, {
		foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' },
		inverse: 'guild',
	})
	declare relatedGuilds?: NonAttribute<RelatedGuild[]>;
	declare getRelatedGuilds: HasManyGetAssociationsMixin<RelatedGuild>;
	declare removeRelatedGuild: HasManyRemoveAssociationMixin<RelatedGuild, RelatedGuild['id']>;
	declare removeRelatedGuilds: HasManyRemoveAssociationsMixin<RelatedGuild, RelatedGuild['id']>;
	declare addRelatedGuild: HasManyAddAssociationMixin<RelatedGuild, RelatedGuild['id']>;
	declare createRelatedGuild: HasManyCreateAssociationMixin<RelatedGuild, 'guildId'>;

	@HasMany(() => BlacklistedUser, {
		foreignKey: { name: 'guildId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' },
	})
	declare blacklistedUsers?: NonAttribute<BlacklistedUser[]>;

	@Attribute({ type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
