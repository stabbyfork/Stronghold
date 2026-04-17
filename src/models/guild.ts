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
	Sequelize,
} from 'sequelize';
import { User } from './user.js';
import { ActivityCheck } from './activityCheck.js';
import { Rank } from './rank.js';
import { UserPermission } from './userPermission.js';
import { RolePermission } from './rolePermission.js';
import { GuildSession } from './session.js';
import { RelatedGuild } from './relatedGuild.js';
import { RobloxUser } from './robloxUser.js';
import { ProxyCommand } from './proxyCommand.js';
import { RoleData } from './roleData.js';
import { RoleGroup } from './roleGroup.js';

export enum GuildAssociations {
	Users = 'users',
	ActivityChecks = 'activityChecks',
	Ranks = 'ranks',
	UserPermissions = 'userPermissions',
	RolePermissions = 'rolePermissions',
	Session = 'session',
	RelatedGuilds = 'relatedGuilds',
	RobloxUsers = 'robloxUsers',
	ProxyCommands = 'proxyCommands',
	Roles = 'roles',
	RoleGroups = 'roleGroups',
}

export class Guild extends Model<InferAttributes<Guild>, InferCreationAttributes<Guild>> {
	/** Internal ID */
	/*
	declare id: number;*/
	/** Discord Guild ID */
	declare guildId: string;
	/** Ready status */
	declare ready: boolean;
	/** Bit flags for stuff to enable */
	declare guildFlags: CreationOptional<number>;
	/** Log channel ID */
	declare logChannelId: string | null;
	/** Priority level for listing (used for promotions) */
	declare priority: CreationOptional<number>;

	/** Diplomacy channel */
	declare dpmChannelId: string | null;
	/** Selected game */
	declare dpmGame: string | null;
	/**
	 * Invite URL to the server
	 * Only the second half (no discord.gg/)
	 * Overshoot 10 max characters for safety
	 * */
	get serverInvite(): string | null {
		const code = this.getDataValue('serverInvite');
		if (!code) return null;
		return 'https://discord.gg/' + code;
	}
	/** Get invite URL */
	get serverUrl(): NonAttribute<string | null> {
		return this.getDataValue('serverInvite');
	}

	declare inactiveRoleId: string | null;
	declare inSessionRoleId: string | null;

	declare tag: string | null;

	declare users?: NonAttribute<User[]>;

	declare activityCheck?: NonAttribute<ActivityCheck>;

	declare ranks?: NonAttribute<Rank[]>;

	declare userPermissions?: NonAttribute<UserPermission[]>;

	declare rolePermissions?: NonAttribute<RolePermission[]>;

	declare session?: NonAttribute<GuildSession>;
	declare getSession: HasOneGetAssociationMixin<GuildSession>;

	declare relatedGuilds?: NonAttribute<RelatedGuild[]>;
	declare getRelatedGuilds: HasManyGetAssociationsMixin<RelatedGuild>;
	declare removeRelatedGuild: HasManyRemoveAssociationMixin<RelatedGuild, RelatedGuild['id']>;
	declare removeRelatedGuilds: HasManyRemoveAssociationsMixin<RelatedGuild, RelatedGuild['id']>;
	declare addRelatedGuild: HasManyAddAssociationMixin<RelatedGuild, RelatedGuild['id']>;
	declare createRelatedGuild: HasManyCreateAssociationMixin<RelatedGuild, 'guildId'>;

	declare robloxUsers?: NonAttribute<RobloxUser[]>;

	declare proxyCommands?: NonAttribute<ProxyCommand[]>;

	declare roleGroups?: NonAttribute<RoleGroup[]>;

	/** Not all roles, only those with special properties */
	declare roles?: NonAttribute<RoleData[]>;

	declare leftAt: Date | null;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initGuildModel(sequelize: Sequelize) {
	Guild.init(
		{
			guildId: { primaryKey: true, type: DataTypes.STRING(20) },
			ready: { allowNull: false, type: DataTypes.BOOLEAN },
			guildFlags: { allowNull: false, defaultValue: 0, type: DataTypes.INTEGER.UNSIGNED },
			logChannelId: { allowNull: true, type: DataTypes.STRING(20) },
			priority: { allowNull: false, defaultValue: 0, type: DataTypes.INTEGER.UNSIGNED },
			dpmChannelId: { allowNull: true, type: DataTypes.STRING(20) },
			dpmGame: { allowNull: true, type: DataTypes.STRING(100) },
			serverInvite: { allowNull: true, type: DataTypes.STRING(12) },
			inactiveRoleId: { allowNull: true, type: DataTypes.STRING(20) },
			inSessionRoleId: { allowNull: true, type: DataTypes.STRING(20) },
			tag: {
				allowNull: true,
				type: DataTypes.STRING(8),
				unique: true,
				validate: {
					isLowercase: true,
					notContains: ' ',
					is: /^[^!]*$/,
				},
			},
			leftAt: { allowNull: true, type: DataTypes.DATE, defaultValue: null },
			createdAt: { type: DataTypes.DATE },
			updatedAt: { type: DataTypes.DATE },
		},
		{ sequelize, modelName: 'Guild', tableName: 'Guilds' },
	);

	return () => {
		Guild.hasMany(User, { as: GuildAssociations.Users, foreignKey: 'guildId' });
		Guild.hasOne(ActivityCheck, { as: GuildAssociations.ActivityChecks, foreignKey: 'guildId' });
		Guild.hasMany(Rank, { as: GuildAssociations.Ranks, foreignKey: 'guildId' });
		Guild.hasMany(UserPermission, { as: GuildAssociations.UserPermissions, foreignKey: 'guildId' });
		Guild.hasMany(RolePermission, { as: GuildAssociations.RolePermissions, foreignKey: 'guildId' });
		Guild.hasOne(GuildSession, { as: GuildAssociations.Session, foreignKey: 'guildId' });
		Guild.hasMany(RelatedGuild, { as: GuildAssociations.RelatedGuilds, foreignKey: 'guildId' });
		Guild.hasMany(RobloxUser, { as: GuildAssociations.RobloxUsers, foreignKey: 'guildId' });
		Guild.hasMany(ProxyCommand, { as: GuildAssociations.ProxyCommands, foreignKey: 'guildId' });
		Guild.hasMany(RoleGroup, { as: GuildAssociations.RoleGroups, foreignKey: 'guildId' });
		Guild.hasMany(RoleData, { as: GuildAssociations.Roles, foreignKey: 'guildId' });
	};
}
