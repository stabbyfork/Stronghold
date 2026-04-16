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
	Sequelize,
} from 'sequelize';
import { MessageLink } from './messageLink.js';

export class SessionOptions extends Model<InferAttributes<SessionOptions>, InferCreationAttributes<SessionOptions>> {
	declare id: CreationOptional<number>;

	/** Associated in {@link GuildSession} */
	declare sessionId: string;

	declare title: string;

	declare message: string;

	/** A link to the message containing the images for this session */
	declare imagesLink?: NonAttribute<MessageLink>;
	declare getImagesLink: HasOneGetAssociationMixin<MessageLink>;
	declare createImagesLink: HasOneCreateAssociationMixin<MessageLink>;
	declare setImagesLink: HasOneSetAssociationMixin<MessageLink, MessageLink['sessionOptionsId']>;
}

export function initSessionOptionsModel(sequelize: Sequelize) {
	SessionOptions.init(
		{
			id: { primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true },
			sessionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
			title: { type: DataTypes.STRING(64), allowNull: false },
			message: { type: DataTypes.STRING(512), allowNull: false },
		},
		{ sequelize, modelName: 'SessionOptions' },
	);

	SessionOptions.hasOne(MessageLink, { as: 'imagesLink', foreignKey: 'sessionOptionsId' });
}
