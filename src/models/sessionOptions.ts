import {
	CreationOptional,
	DataTypes,
	HasOneCreateAssociationMixin,
	HasOneGetAssociationMixin,
	HasOneSetAssociationMixin,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, HasOne } from '@sequelize/core/decorators-legacy';
import { MessageLink } from './messageLink.js';

export class SessionOptions extends Model<InferAttributes<SessionOptions>, InferCreationAttributes<SessionOptions>> {
	@Attribute({ primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true })
	declare id: CreationOptional<number>;

	/** Associated in {@link GuildSession} */
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: false })
	declare sessionId: string;

	@Attribute({ type: DataTypes.STRING(64), allowNull: false })
	declare title: string;

	@Attribute({ type: DataTypes.STRING(256), allowNull: false })
	declare message: string;

	/** A link to the message containing the images for this session */
	@HasOne(() => MessageLink, { foreignKey: { name: 'sessionOptionsId', onUpdate: 'CASCADE', onDelete: 'CASCADE' } })
	declare imagesLink?: NonAttribute<MessageLink>;
	declare getImagesLink: HasOneGetAssociationMixin<MessageLink>;
	declare createImagesLink: HasOneCreateAssociationMixin<MessageLink, 'sessionOptionsId'>;
	declare setImagesLink: HasOneSetAssociationMixin<MessageLink, MessageLink['sessionOptionsId']>;
}
