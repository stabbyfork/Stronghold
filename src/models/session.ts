import {
	CreationOptional,
	DataTypes,
	HasManyAddAssociationMixin,
	HasManyCreateAssociationMixin,
	HasManyGetAssociationsMixin,
	HasManyHasAssociationMixin,
	HasManyRemoveAssociationMixin,
	HasManySetAssociationsMixin,
	HasOneCreateAssociationMixin,
	HasOneGetAssociationMixin,
	HasOneSetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { SessionOptions } from './sessionOptions.js';
import { SessionParticipant } from './sessionParticipant.js';

export enum GuildSessionAssociations {
	DefaultOptions = 'defaultOptions',
	Participants = 'participants',
}

export class GuildSession extends Model<InferAttributes<GuildSession>, InferCreationAttributes<GuildSession>> {
	declare id: CreationOptional<string>;

	/** Associated in {@link Guild} */
	declare guildId: string;

	declare channelId: string;

	declare startedAt: Date | null;

	declare endedAt: Date | null;

	declare active: boolean;

	declare sessionMessageId: string | null;

	declare defaultOptions?: NonAttribute<SessionOptions>;
	declare createDefaultOptions: HasOneCreateAssociationMixin<SessionOptions>;
	declare setDefaultOptions: HasOneSetAssociationMixin<SessionOptions, SessionOptions['sessionId']>;
	declare getDefaultOptions: HasOneGetAssociationMixin<SessionOptions>;

	/** Users that have ever joined (even if currently not in) this session */
	declare participants?: NonAttribute<SessionParticipant[]>;

	declare createParticipant: HasManyCreateAssociationMixin<SessionParticipant, 'sessionId'>;
	declare addParticipant: HasManyAddAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare hasParticipant: HasManyHasAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare removeParticipant: HasManyRemoveAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare setParticipants: HasManySetAssociationsMixin<SessionParticipant, SessionParticipant['id']>;
	declare getParticipants: HasManyGetAssociationsMixin<SessionParticipant>;

	/** Time required to be spent in the session (in milliseconds) */
	declare timeQuota: CreationOptional<number>;

	/** Points to add to participants when the session ends */
	declare pointsToAdd: number | null;

	/** Whether participants must meet the time quota to receive points */
	declare mustMeetQuota: CreationOptional<boolean>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initGuildSessionModel(sequelize: Sequelize) {
	GuildSession.init(
		{
			id: { primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
			channelId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
			startedAt: { type: DataTypes.DATE, allowNull: true },
			endedAt: { type: DataTypes.DATE, allowNull: true },
			active: { type: DataTypes.BOOLEAN, allowNull: false },
			sessionMessageId: { type: DataTypes.STRING(20), allowNull: true },
			timeQuota: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
			pointsToAdd: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			mustMeetQuota: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{ sequelize, modelName: 'GuildSession' },
	);

	GuildSession.hasOne(SessionOptions, {
		as: GuildSessionAssociations.DefaultOptions,
		foreignKey: 'sessionId',
	});
	GuildSession.hasMany(SessionParticipant, {
		as: GuildSessionAssociations.Participants,
		foreignKey: 'sessionId',
	});
}
