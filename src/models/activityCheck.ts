import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import { Attribute, BelongsTo } from '@sequelize/core/decorators-legacy';
import { Guild } from './guild.js';
export class ActivityCheck extends Model<InferAttributes<ActivityCheck>, InferCreationAttributes<ActivityCheck>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	@Attribute({ allowNull: false, type: DataTypes.STRING(20) })
	declare guildId: string;

	@Attribute({ allowNull: false, type: DataTypes.STRING(20) })
	declare channelId: string;

	@Attribute({ allowNull: true, type: DataTypes.STRING(20) })
	declare currentMessageId: string | null;

	@Attribute({ allowNull: false, type: DataTypes.STRING(20) })
	declare sequence: string;

	/**
	 * The interval between activity checks, in seconds
	 */
	@Attribute({ allowNull: true, type: DataTypes.INTEGER.UNSIGNED })
	declare interval: number | null;

	/**
	 * The last time the activity check was run, in seconds since epoch
	 */
	@Attribute({ allowNull: false, type: DataTypes.INTEGER })
	declare lastRun: number;

	@Attribute({ allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false })
	declare paused: CreationOptional<boolean>;

	/**
	 * Maximum number of inactivity strikes a user can have before being eligible for a kick.
	 * (Exclusive, if exceeded, user will be kicked)
	 * (If 0, the user will be immediately kicked for not reacting)
	 */
	@Attribute({ allowNull: false, type: DataTypes.INTEGER.UNSIGNED })
	declare maxStrikes: number;

	@Attribute({ allowNull: false, type: DataTypes.DATE })
	declare createdAt: CreationOptional<Date>;

	@Attribute({ allowNull: false, type: DataTypes.DATE })
	declare updatedAt: CreationOptional<Date>;
}
