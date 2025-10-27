import {
	Model,
	InferAttributes,
	InferCreationAttributes,
	CreationOptional,
	DataTypes,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, BelongsTo, Table } from '@sequelize/core/decorators-legacy';
import { User } from './user.js';
import { GuildSession } from './session.js';

export enum SessionParticipantAssociations {
	Session = 'session',
	User = 'user',
}

@Table({
	indexes: [{ unique: true, fields: ['sessionId', 'userId'] }],
})
export class SessionParticipant extends Model<
	InferAttributes<SessionParticipant>,
	InferCreationAttributes<SessionParticipant>
> {
	@Attribute({ primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true })
	declare id: CreationOptional<number>;

	@BelongsTo(() => GuildSession, {
		foreignKey: { name: 'sessionId', allowNull: true, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
	})
	declare session?: NonAttribute<GuildSession>;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true })
	declare sessionId: number | null;

	@BelongsTo(() => User, {
		foreignKey: { name: 'userId', allowNull: false, onUpdate: 'RESTRICT', onDelete: 'CASCADE' },
	})
	declare user?: NonAttribute<User>;

	/** Database ID, not Discord user ID */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare userId: number;

	@Attribute({ type: DataTypes.BOOLEAN })
	declare inSession: boolean;

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 })
	declare timeSpent: CreationOptional<number>;

	@Attribute({ type: DataTypes.DATE, allowNull: true })
	declare joinedAt: Date | null;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
