import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import { Attribute, Table, ValidateAttribute } from '@sequelize/core/decorators-legacy';

@Table({
	indexes: [{ unique: true, fields: ['guildId', 'proxyCommand'] }],
})
export class ProxyCommand extends Model<InferAttributes<ProxyCommand>, InferCreationAttributes<ProxyCommand>> {
	@Attribute({ type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true })
	declare id: CreationOptional<number>;

	@Attribute({ type: DataTypes.STRING(20), allowNull: false })
	declare guildId: string;

	@Attribute({ type: DataTypes.STRING(32), allowNull: false })
	declare targetCommand: string;

	@Attribute({ type: DataTypes.STRING(32), allowNull: false })
	@ValidateAttribute({
		is: /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u,
	})
	declare proxyCommand: string;
	@Attribute({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true })
	declare valid: CreationOptional<boolean>;

	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare createdAt: CreationOptional<Date>;
	@Attribute({ type: DataTypes.DATE, allowNull: false })
	declare updatedAt: CreationOptional<Date>;
}
