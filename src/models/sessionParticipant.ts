import {
	InferAttributes,
	InferCreationAttributes,
	CreationOptional,
	DataTypes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { User } from './user.js';
import { GuildSession } from './session.js';

export enum SessionParticipantAssociations {
	Session = 'session',
	User = 'user',
}

export class SessionParticipant extends Model<
	InferAttributes<SessionParticipant>,
	InferCreationAttributes<SessionParticipant>
> {
	declare id: CreationOptional<number>;

	declare session?: NonAttribute<GuildSession>;

	declare sessionId: number | null;

	declare user?: NonAttribute<User>;

	/** Database ID, not Discord user ID */
	declare userId: number;

	declare inSession: boolean;

	declare timeSpent: CreationOptional<number>;

	get totalTimeSpent(): NonAttribute<number> {
		return this.timeSpent + (this.inSession ? Date.now() - this.joinedAt!.getTime() : 0);
	}

	declare joinedAt: Date | null;

	declare createdAt: CreationOptional<Date>;

	declare updatedAt: CreationOptional<Date>;
}

export function initSessionParticipantModel(sequelize: Sequelize) {
	SessionParticipant.init(
		{
			id: { primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true },
			sessionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			inSession: { type: DataTypes.BOOLEAN },
			timeSpent: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
			joinedAt: { type: DataTypes.DATE, allowNull: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'SessionParticipant',
			indexes: [{ unique: true, fields: ['sessionId', 'userId'] }],
		},
	);
	SessionParticipant.belongsTo(GuildSession, {
		as: SessionParticipantAssociations.Session,
		foreignKey: 'sessionId',
	});
	SessionParticipant.belongsTo(User, {
		as: SessionParticipantAssociations.User,
		foreignKey: 'userId',
	});
}
