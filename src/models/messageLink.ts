import {
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import { Message } from 'discord.js';
import { client } from '../client.js';

export class MessageLink extends Model<InferAttributes<MessageLink>, InferCreationAttributes<MessageLink>> {
	declare id: CreationOptional<number>;
	declare guildId: string;
	declare channelId: string;
	declare messageId: string;
	get fullLinkUrl(): NonAttribute<string> {
		return `https://discord.com/channels/${this.guildId}/${this.channelId}/${this.messageId}`;
	}
	async getMessage(): Promise<NonAttribute<Message>> {
		const guild =
			client.guilds.cache.get(this.getDataValue('guildId')) ??
			(await client.guilds.fetch(this.getDataValue('guildId')));
		const channel =
			guild.channels.cache.get(this.getDataValue('channelId')) ??
			(await guild.channels.fetch(this.getDataValue('channelId')));
		if (!channel?.isSendable()) return Promise.reject(new Error('Channel no longer exists or is not sendable'));
		const message =
			channel.messages.cache.get(this.getDataValue('messageId')) ??
			(await channel.messages.fetch(this.getDataValue('messageId')));
		return message;
	}

	declare sessionOptionsId: number | null;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initMessageLinkModel(sequelize: Sequelize) {
	MessageLink.init(
		{
			id: { primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			channelId: { type: DataTypes.STRING(20), allowNull: false },
			messageId: { type: DataTypes.STRING(20), allowNull: false },
			sessionOptionsId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, unique: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'MessageLink',
			indexes: [{ unique: true, fields: ['guildId', 'channelId', 'messageId'] }],
		},
	);
	return () => {};
}
