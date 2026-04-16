import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ProxyCommand extends Model<InferAttributes<ProxyCommand>, InferCreationAttributes<ProxyCommand>> {
	declare id: CreationOptional<number>;

	declare guildId: string;

	declare targetCommand: string;

	declare proxyCommand: string;
	declare valid: CreationOptional<boolean>;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

export function initProxyCommandModel(sequelize: Sequelize) {
	ProxyCommand.init(
		{
			id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
			guildId: { type: DataTypes.STRING(20), allowNull: false },
			targetCommand: { type: DataTypes.STRING(32), allowNull: false },
			proxyCommand: {
				type: DataTypes.STRING(32),
				allowNull: false,
				validate: { is: /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u },
			},
			valid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
			createdAt: { type: DataTypes.DATE, allowNull: false },
			updatedAt: { type: DataTypes.DATE, allowNull: false },
		},
		{
			sequelize,
			modelName: 'ProxyCommand',
			indexes: [{ unique: true, fields: ['guildId', 'proxyCommand'] }],
		},
	);
}
