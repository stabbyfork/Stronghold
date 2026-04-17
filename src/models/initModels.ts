import { Sequelize } from 'sequelize';
import { initActivityCheckModel } from './activityCheck.js';
import { initGuildModel } from './guild.js';
import { initMessageLinkModel } from './messageLink.js';
import { initProxyCommandModel } from './proxyCommand.js';
import { initRankModel } from './rank.js';
import { initRankUsageModel } from './rankUsage.js';
import { initRelatedGuildModel } from './relatedGuild.js';
import { initRobloxUserModel } from './robloxUser.js';
import { initRoleDataModel } from './roleData.js';
import { initRoleGroupModel } from './roleGroup.js';
import { initRolePermissionModel } from './rolePermission.js';
import { initGuildSessionModel } from './session.js';
import { initSessionOptionsModel } from './sessionOptions.js';
import { initSessionParticipantModel } from './sessionParticipant.js';
import { initUserModel } from './user.js';
import { initUserPermissionModel } from './userPermission.js';

let initialised = false;

export function initialiseModels(sequelize: Sequelize): (() => void)[] {
	if (initialised) return [];
	const associateList: (() => void)[] = [
		initGuildModel(sequelize),
		initUserPermissionModel(sequelize),
		initRolePermissionModel(sequelize),
		initUserModel(sequelize),
		initActivityCheckModel(sequelize),
		initRankModel(sequelize),
		initRankUsageModel(sequelize),
		initMessageLinkModel(sequelize),
		initGuildSessionModel(sequelize),
		initSessionOptionsModel(sequelize),
		initRelatedGuildModel(sequelize),
		initSessionParticipantModel(sequelize),
		initRobloxUserModel(sequelize),
		initProxyCommandModel(sequelize),
		initRoleDataModel(sequelize),
		initRoleGroupModel(sequelize),
	];

	initialised = true;
	return associateList;
}
