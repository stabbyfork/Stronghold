import { CreationOptional, DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from 'sequelize';
export class ActivityCheck extends Model<InferAttributes<ActivityCheck>, InferCreationAttributes<ActivityCheck>> {
	declare id: CreationOptional<number>;

	declare guildId: string;

	declare channelId: string;

	declare currentMessageId: string | null;

	declare sequence: string;

	/**
	 * The interval between activity checks, in seconds
	 */
	declare interval: number | null;

	/**
	 * The last time the activity check was run, in seconds since epoch
	 */
	declare lastRun: number;

	declare paused: CreationOptional<boolean>;

	/**
	 * Maximum number of inactivity strikes a user can have before being eligible for a kick.
	 * (Exclusive, if exceeded, user will be kicked)
	 * (If 0, the user will be immediately kicked for not reacting)
	 */
	declare maxStrikes: number;

	declare createdAt: CreationOptional<Date>;

	declare updatedAt: CreationOptional<Date>;
}

export function initActivityCheckModel(sequelize: Sequelize) {
	ActivityCheck.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { allowNull: false, type: DataTypes.STRING(20) },
			channelId: { allowNull: false, type: DataTypes.STRING(20) },
			currentMessageId: { allowNull: true, type: DataTypes.STRING(20) },
			sequence: { allowNull: false, type: DataTypes.STRING(20) },
			interval: { allowNull: true, type: DataTypes.INTEGER.UNSIGNED },
			lastRun: { allowNull: false, type: DataTypes.INTEGER },
			paused: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
			maxStrikes: { allowNull: false, type: DataTypes.INTEGER.UNSIGNED },
			createdAt: { allowNull: false, type: DataTypes.DATE },
			updatedAt: { allowNull: false, type: DataTypes.DATE },
		},
		{ sequelize, modelName: 'ActivityCheck' },
	);
	return () => {};
}
