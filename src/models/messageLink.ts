import {
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
	NonAttribute,
} from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';
import { Message } from 'discord.js';
import { client } from '../client.js';

@Table({ indexes: [{ unique: true, fields: ['guildId', 'channelId', 'messageId'] }] })
export class MessageLink extends Model<InferAttributes<MessageLink>, InferCreationAttributes<MessageLink>> {
	@Attribute({ primaryKey: true, type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true })
	declare id: CreationOptional<number>;
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;
	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare channelId: string;
	@Attribute({ type: DataTypes.STRING(20), allowNull: false /*, unique: true*/ })
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

	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, allowNull: true, unique: true })
	declare sessionOptionsId: number | null;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
