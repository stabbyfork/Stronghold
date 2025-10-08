import { Lock, Op, Sequelize, Transaction } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import { SqliteDialect } from '@sequelize/sqlite3';
import { userMention } from 'discord.js';
import { client } from './client.js';
import { Config } from './config.js';
import { ActivityCheck } from './models/activityCheck.js';
import { Guild } from './models/guild.js';
import { MessageLink } from './models/messageLink.js';
import { Rank, RankAssociations } from './models/rank.js';
import { RankUsage } from './models/rankUsage.js';
import { RolePermission } from './models/rolePermission.js';
import { GuildSession } from './models/session.js';
import { SessionOptions } from './models/sessionOptions.js';
import { User } from './models/user.js';
import { UserPermission } from './models/userPermission.js';
import { Errors } from './types/errors.js';
import { Debug } from './utils/errorsUtils.js';
import { RelatedGuild } from './models/relatedGuild.js';

const dbConfg = Config.get('database');

export namespace Data {
	let ready = false;

	export const models = {
		Guild,
		UserPermission,
		RolePermission,
		User,
		ActivityCheck,
		Rank,
		RankUsage,
		MessageLink,
		GuildSession,
		SessionOptions,
		RelatedGuild,
	};
	export const mainDb =
		process.env.NODE_ENV === 'prod'
			? new Sequelize({
					password: dbConfg.password,
					user: dbConfg.username,
					database: dbConfg.name,
					host: dbConfg.host,
					port: dbConfg.port,
					dialect: MySqlDialect,
					logging: false,
					pool: {
						max: 5,
						min: 1,
						idle: 10000,
						acquire: 5000,
					},
					models: Object.values(models),
				})
			: new Sequelize({
					dialect: SqliteDialect,
					storage: ':memory:',
					pool: {
						max: 1,
						min: 1,
						idle: Infinity,
					},
					benchmark: true,
					logging: (q, t) => console.log(q, t, 'ms'),
					models: Object.values(models),
				});

	export async function setup() {
		if (ready) {
			Debug.error('Attempting to setup Data, which is already ready');
			return;
		}
		try {
			await mainDb.authenticate();
			console.log('Database connections established successfully');
		} catch (error) {
			throw new Error(`Error while connecting to database: ${error}`);
		}

		await mainDb.sync().catch((err) => {
			throw new Error(`Error while syncing database: ${err}`);
		});
		process.on('SIGTERM', handleShutdown);
		process.on('SIGINT', handleShutdown);
		ready = true;
	}

	export function isReady() {
		return ready;
	}

	export function closeDb() {
		return mainDb.close();
	}

	async function handleShutdown() {
		console.log('Shutting down database');
	}

	export async function reconcileRanks(user: User, transaction: Transaction) {
		const currentRanks = await user.getRanks({ transaction });
		const mainRank = await user.getMainRank({ transaction });
		const guild = client.guilds.cache.get(user.guildId) ?? (await client.guilds.fetch(user.guildId));
		const member = guild.members.cache.get(user.userId) ?? (await guild.members.fetch(user.userId));

		if (mainRank) {
			await member.roles.add(mainRank.roleId, 'Gained enough points for this rank.');
		}
		const allRanks = await Data.models.Rank.findAll({ where: { guildId: user.guildId }, transaction });
		const mappedIds = currentRanks.map((r) => r.rankId);
		await member.roles.remove(
			allRanks.filter((r) => r.rankId !== mainRank?.rankId && !mappedIds.includes(r.rankId)).map((r) => r.roleId),
			'Not owned anymore.',
		);
		await member.roles.add(
			currentRanks.map((r) => r.roleId),
			'Gained enough points for this rank.',
		);
	}

	function diffRanks(newRanks: Rank[], currentRanks: Rank[]): [added: Rank[], removed: Rank[]] {
		const newIds = new Set(newRanks.map((r) => r.rankId));
		const currentIds = new Set(currentRanks.map((r) => r.rankId));

		const added = newRanks.filter((r) => !currentIds.has(r.rankId));
		const removed = currentRanks.filter((r) => !newIds.has(r.rankId));

		return [added, removed];
	}

	async function _promoteUser(user: User, transaction: Transaction) {
		const guildId = user.guildId;
		const userPoints = user.points ?? 0;
		const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
		const member = guild.members.cache.get(user.userId) ?? (await guild.members.fetch(user.userId));

		// No include usage because stackables can't have limits
		const currentRanks = await user.getRanks({ transaction });
		const newRanks = await Data.models.Rank.findAll({
			where: { guildId, pointsRequired: { [Op.lte]: userPoints }, stackable: true },
			order: [['pointsRequired', 'DESC']],
			transaction,
		});
		const [added, removed] = diffRanks(newRanks, currentRanks);
		if (added.length !== 0) {
			await member.roles.add(
				added.map((r) => r.roleId),
				'Gained enough points for this rank.',
			);
			await user.addRanks(added, { transaction });
		}
		if (removed.length !== 0) {
			await member.roles.remove(
				removed.map((r) => r.roleId),
				'Lost enough points to lose this rank.',
			);
			await user.removeRanks(removed, { transaction });
		}

		const currentRank = await user.getMainRank({ transaction, include: [RankAssociations.RankUsage] });

		// 1. Fetch all ranks the user qualifies for (highest to lowest)
		const ranks = await Data.models.Rank.findAll({
			where: { guildId, pointsRequired: { [Op.lte]: userPoints }, stackable: false },
			order: [['pointsRequired', 'DESC']],
			include: [RankAssociations.RankUsage],
			transaction,
		});

		let bestRank: Rank | null = null;
		let nextRank: Rank | null = null;

		// 2. Pick the best available rank
		for (let i = 0; i < ranks.length; i++) {
			const rank = ranks[i];
			if (rank.userLimit === 0) continue;
			const usage = rank.rankUsage?.userCount ?? 0;
			if (rank.userLimit !== -1 && usage >= rank.userLimit) continue;

			bestRank = rank;
			break;
		}
		nextRank = await Data.models.Rank.findOne({
			where: {
				guildId,
				pointsRequired: {
					[Op.gt]: bestRank?.pointsRequired ?? userPoints,
				},
				stackable: false,
			},
			order: [['pointsRequired', 'ASC']],
			transaction,
		});

		await user.setNextRank(nextRank as any, { transaction });

		// 3. If no available rank then set to null
		if (!bestRank) {
			if (member && currentRank) {
				await member.roles.remove(currentRank.roleId);
			}
			await user.setMainRank(null as any, { transaction });
			if (currentRank) {
				await currentRank.rankUsage?.decrement('userCount', { by: 1, transaction });
			}
			return null;
		}

		// 4. If already in the best rank then nothing to do
		if (user.mainRankId === bestRank.rankId) {
			return bestRank;
		}

		// 5. Lock RankUsage row for bestRank
		const [usageRow] = await Data.models.RankUsage.findOrCreate({
			where: { rankId: bestRank.rankId },
			defaults: { rankId: bestRank.rankId, userCount: 0 },
			transaction: transaction,
			lock: Lock.UPDATE,
		});

		if (bestRank.userLimit !== -1 && usageRow.userCount >= bestRank.userLimit) {
			// rank filled mid-transaction then retry outer function
			throw new Errors.DatabaseError(`Cannot assign user ${userMention(user.userId)} to rank because it is full`);
		}

		// 6. Decrement old rank usage
		if (user.mainRankId) {
			const oldUsage = await Data.models.RankUsage.findOne({
				where: { rankId: user.mainRankId },
				transaction: transaction,
				lock: Lock.UPDATE,
			});
			if (oldUsage) {
				oldUsage.userCount = Math.max(0, oldUsage.userCount - 1);
				await oldUsage.save({ transaction: transaction });
			}
		}

		// 7. Increment new rank usage
		usageRow.userCount += 1;
		await usageRow.save({ transaction: transaction });

		// 8. Update user rank
		user.setMainRank(bestRank, { transaction });
		await user.save({ transaction: transaction });

		if (member) {
			await member.roles.add(bestRank.roleId, 'Promoted to new rank.');
			if (currentRank) await member.roles.remove(currentRank.roleId, 'Promoted to new rank.');
		}

		return bestRank;
	}

	// Thanks ChatGPT
	/**
	 * Promote a user to the best available rank (highest to lowest).
	 * If the user is already in the best available rank, then nothing is done.
	 * If no available rank can be found, then null is returned.
	 *
	 * This function is transactional, meaning that if any part of it fails, the entire function will rollback and return null.
	 * This is useful for ensuring that the promotion process is atomic and safe.
	 *
	 * @param user The user to promote.
	 * @param t An optional transaction to use when promoting the user.
	 * @returns The best available rank for the user, or null if no promotion was possible.
	 */
	export async function promoteUser(user: User, t?: Transaction) {
		if (t) {
			return await _promoteUser(user, t);
		} else {
			await mainDb.transaction(async (t) => {
				return await _promoteUser(user, t);
			});
		}
	}
	/*export async function nextRank(user: User, transaction?: Transaction) {
		const guildId = user.guildId;
		const rankId = user.mainRankId;
		const rank = rankId ? await Data.models.Rank.findByPk(rankId, { transaction }) : null;
		return await Data.models.Rank.findOne({
			where: {
				guildId,
				pointsRequired: {
					[Op.gt]: rank?.pointsRequired ?? user.points,
				},
			},
			order: [['pointsRequired', 'ASC']],
			transaction,
		});
	}*/
}
