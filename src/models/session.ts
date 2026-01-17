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
} from '@sequelize/core';
import { Attribute, HasMany, HasOne } from '@sequelize/core/decorators-legacy';
import { SessionOptions } from './sessionOptions.js';
import { SessionParticipant } from './sessionParticipant.js';

export enum GuildSessionAssociations {
	DefaultOptions = 'defaultOptions',
	Participants = 'participants',
}

export class GuildSession extends Model<InferAttributes<GuildSession>, InferCreationAttributes<GuildSession>> {
	@Attribute({ primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true })
	declare id: CreationOptional<string>;

	/** Associated in {@link Guild} */
	@Attribute({ type: DataTypes.STRING(20), allowNull: false, unique: true })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false, unique: true })
	declare channelId: string;

	@Attribute({ type: DataTypes.DATE, allowNull: true })
	declare startedAt: Date | null;

	@Attribute({ type: DataTypes.DATE, allowNull: true })
	declare endedAt: Date | null;

	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false })
	declare active: boolean;

	@Attribute({ type: DataTypes.STRING(20), allowNull: true })
	declare sessionMessageId: string | null;

	@HasOne(() => SessionOptions, { foreignKey: { name: 'sessionId', onUpdate: 'RESTRICT', onDelete: 'CASCADE' } })
	declare defaultOptions?: NonAttribute<SessionOptions>;
	declare createDefaultOptions: HasOneCreateAssociationMixin<SessionOptions, 'sessionId'>;
	declare setDefaultOptions: HasOneSetAssociationMixin<SessionOptions, SessionOptions['sessionId']>;
	declare getDefaultOptions: HasOneGetAssociationMixin<SessionOptions>;

	/** Users that have ever joined (even if currently not in) this session */
	@HasMany(() => SessionParticipant, { foreignKey: { name: 'sessionId', onUpdate: 'CASCADE', onDelete: 'CASCADE' } })
	declare participants?: NonAttribute<SessionParticipant[]>;

	declare createParticipant: HasManyCreateAssociationMixin<SessionParticipant, 'sessionId'>;
	declare addParticipant: HasManyAddAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare hasParticipant: HasManyHasAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare removeParticipant: HasManyRemoveAssociationMixin<SessionParticipant, SessionParticipant['id']>;
	declare setParticipants: HasManySetAssociationsMixin<SessionParticipant, SessionParticipant['id']>;
	declare getParticipants: HasManyGetAssociationsMixin<SessionParticipant>;

	/** Time required to be spent in the session (in milliseconds) */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 })
	declare timeQuota: CreationOptional<number>;

	/** Points to add to participants when the session ends */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare pointsToAdd: number | null;

	/** Whether participants must meet the time quota to receive points */
	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
	declare mustMeetQuota: CreationOptional<boolean>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
