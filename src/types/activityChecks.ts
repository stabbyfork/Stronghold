//#region activityChecks

import { Op, Transaction } from '@sequelize/core';
import { Guild, roleMention, userMention } from 'discord.js';
import _ from 'lodash';
import { client } from '../client.js';
import { createActivityCheckEmbed, getDefaultActivityCheckEmoji } from '../commands/activity/checks/create.js';
import { Data } from '../data.js';
import { defaultEmbed } from '../utils/discordUtils.js';
import { Debug } from '../utils/errorsUtils.js';
import { hasPermissions, Permission } from '../utils/permissionsUtils.js';
import { Errors } from './errors.js';

export enum ActivityCheckEvent {
	MessageInactive = 1,
	KickInactiveOverStrikesLimit = 2,
	DeleteCurrentMessage = 3,
	AddRoleToInactiveAndRemoveFromActive = 4,
	PingInactive = 5,
	SendNextMessage = 6,
}

// Validate
const _used = new Set();
for (const event of Object.values(ActivityCheckEvent)) {
	if (!_.isNumber(event)) {
		continue;
	}
	const evtName = ActivityCheckEvent[event as ActivityCheckEvent];
	if (event <= 0) {
		throw new Errors.ValidationError(`Below or equal to 0 activity check event: ${evtName}`);
	}
	if (_used.has(event)) {
		throw new Errors.ValidationError(`Duplicate activity check event: ${evtName}`);
	}
	_used.add(event);
}

export class ActivityCheckSequence {
	static readonly VERSION = '1.0.0';
	static readonly SEPARATOR = ' ';
	static readonly DEFAULT = new ActivityCheckSequence([ActivityCheckEvent.AddRoleToInactiveAndRemoveFromActive]);
	static readonly EVENT_HANDLERS = {
		[ActivityCheckEvent.MessageInactive]: async (args) => {
			const { guild, inactiveUsers } = args;
			inactiveUsers.forEach(async (u) => {
				if (
					await Data.models.User.findOne({
						where: {
							guildId: guild.id,
							userId: u,
							points: {
								[Op.gt]: 0,
							},
						},
					})
				)
					return;
				await guild.members.cache.get(u)?.send({
					embeds: [
						defaultEmbed()
							.setTitle('Inactivity Notice')
							.setDescription(
								`You have been marked as inactive in \`${guild.name}\` (${guild.vanityURLCode ? `https://discord.gg/${guild.vanityURLCode}` : `\`${guild.id}\``}). To be marked as active, simply react to the server's next activity check (or the current one if it will be run again).`,
							)
							.setColor('Yellow')
							.setThumbnail(guild.iconURL()),
					],
				});
			});
		},
		// Will not kick users with noInactivityKick
		[ActivityCheckEvent.KickInactiveOverStrikesLimit]: async (args) => {
			const { guild, inactiveUsers, transaction } = args;
			inactiveUsers.forEach(async (u) => {
				const userData = await Data.models.User.findOne({
					where: {
						guildId: guild.id,
						userId: u,
					},
					transaction,
				});
				const maxStrikes =
					(
						await Data.models.ActivityCheck.findOne({
							where: {
								guildId: guild.id,
							},
							attributes: ['maxStrikes'],
							transaction,
						})
					)?.maxStrikes ?? 3;
				if (userData && userData.inactivityStrikes > maxStrikes) {
					const user = guild.members.cache.get(u);
					if (!user) return;
					if (await hasPermissions(user, guild, true, Permission.NoInactivityKick)) return;
					await user.send({
						embeds: [
							defaultEmbed()
								.setTitle('Kicked for inactivity')
								.setDescription(
									`You have been marked as inactive in \`${guild.name}\` (\`${guild.id}\`) and exceeded the server's limit of \`${maxStrikes}\` strikes, and thus kicked. To be marked as active, react to the server's activity checks. You may join the server again at any time by using an invite link or asking ${userMention(guild.ownerId)} (by DM) for an invite.`,
								)
								.setColor('Red')
								.setImage(guild.iconURL()),
						],
					});
					await user.kick('Inactivity strike maximum exceeded');
					const inst = await Data.models.User.findOne({
						where: {
							guildId: guild.id,
							userId: u,
						},
						transaction,
					});
					if (inst) {
						inst.inactivityStrikes = 0;
						await inst.save();
					}
				}
			});
		},
		[ActivityCheckEvent.DeleteCurrentMessage]: async (args) => {
			const { guild } = args;
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
			});
			if (check?.currentMessageId) {
				const channel = await guild.channels.fetch(check.channelId);
				if (channel && channel.isTextBased()) {
					const message = await channel.messages.fetch(check.currentMessageId);
					if (message) {
						await message.delete();
					}
				}
				check.currentMessageId = null;
				await check.save();
			}
		},
		[ActivityCheckEvent.AddRoleToInactiveAndRemoveFromActive]: async (args) => {
			const { guild, inactiveUsers, activeUsers, transaction } = args;
			const inactiveRoleId = (
				await Data.models.Guild.findOne({
					where: {
						guildId: guild.id,
					},
				})
			)?.inactiveRoleId;
			if (!inactiveRoleId) {
				Debug.error('Guild does not have inactive role set during activity check');
				return;
			}
			const inactiveRole = guild.roles.cache.get(inactiveRoleId!);
			if (!inactiveRole) {
				Debug.error('Inactive role not found during activity check');
				return;
			}
			inactiveUsers.forEach(async (u) => {
				const user = guild.members.cache.get(u) ?? (await guild.members.fetch(u));
				if (!user) return;
				if (!user.roles.cache.has(inactiveRole.id)) {
					await user.roles.add(inactiveRole, 'Did not react to an activity check, considered inactive');
				}
			});
			activeUsers.forEach(async (u) => {
				const user = guild.members.cache.get(u) ?? (await guild.members.fetch(u));
				if (!user) return;
				if (user.roles.cache.has(inactiveRole.id)) {
					await user.roles.remove(inactiveRole, 'Reacted to an activity check');
				}
			});
		},
		[ActivityCheckEvent.PingInactive]: async (args) => {
			const { guild, transaction } = args;
			const inactiveRole = (
				await Data.models.Guild.findOne({
					where: {
						guildId: guild.id,
					},
					attributes: ['inactiveRoleId'],
					transaction,
				})
			)?.inactiveRoleId;
			if (!inactiveRole) {
				Debug.error('Failed to get inactive role during activity check');
				return;
			}
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
				transaction,
			});
			if (!check) {
				Debug.error('No activity check found for guild');
				return;
			}
			const channel = guild.channels.cache.get(check.channelId);
			if (channel && channel.isSendable()) {
				channel.send({
					content: `${roleMention(inactiveRole)}`,
				});
			}
		},
		[ActivityCheckEvent.SendNextMessage]: async (args) => {
			const { guild, transaction } = args;
			const check = await Data.models.ActivityCheck.findOne({
				where: {
					guildId: guild.id,
				},
				transaction,
			});
			if (!check) {
				Debug.error('No activity check found for guild');
				return;
			}
			try {
				const channel = await (await client.guilds.fetch(check.guildId)).channels.fetch(check.channelId);
				const maxStrikes = check.maxStrikes;
				if (channel && channel.isSendable()) {
					const msg = await channel.send(
						createActivityCheckEmbed(getDefaultActivityCheckEmoji(), maxStrikes),
					);
					await msg.react(getDefaultActivityCheckEmoji());
					check.currentMessageId = msg.id;
					await check.save();
				}
			} catch (e) {
				Debug.error('Error while sending activity check:', e);
			}
		},
	} satisfies {
		[K in ActivityCheckEvent]: (info: {
			guild: Guild;
			activeUsers: Set<string>;
			inactiveUsers: Set<string>;
			transaction: Transaction;
		}) => Promise<void>;
	};
	constructor(private readonly sequence: ActivityCheckEvent[]) {}
	/**
	 * Serialises the {@link ActivityCheckSequence} into a spaced string, separated by commas.
	 *
	 * @returns The serialised {@link ActivityCheckSequence}.
	 * @property sequence - The sequence of events, formatted as a string.
	 * @property version - The version of the serialised format.
	 * @throws If an invalid event is found.
	 */
	prettyPrint() {
		const out = {
			sequence: '',
			version: ActivityCheckSequence.VERSION,
		};
		const evtList: string[] = [];
		for (const evt of this.getSequence()) {
			const evtName = ActivityCheckEvent[evt];
			evtList.push(evtName);
		}
		out.sequence = evtList.map((e) => `${_.startCase(e)}`).join(', ');
		return out;
	}
	toString() {
		return this.sequence.join(ActivityCheckSequence.SEPARATOR);
	}
	/**
	 * Parses a string into an {@link ActivityCheckSequence}.
	 * @param sequence A string, separated by {@link ActivityCheckSequence.SEPARATOR}, containing the events to run.
	 * @throws {Errors.ActivityCheckSequenceError} If the sequence is invalid.
	 * @returns An {@link ActivityCheckSequence} object.
	 */
	static fromString(sequence: string) {
		if (!ActivityCheckSequence.isValid(sequence)) {
			throw new Errors.ActivityCheckSequenceError('Invalid sequence.');
		}
		const evtArr = sequence.split(ActivityCheckSequence.SEPARATOR).map((e) => {
			let num: number;
			if (typeof ActivityCheckEvent[e as keyof typeof ActivityCheckEvent] === 'number') {
				num = ActivityCheckEvent[e as keyof typeof ActivityCheckEvent];
			} else {
				num = parseInt(e);
			}
			return num;
		});
		return new ActivityCheckSequence(evtArr);
	}
	/**
	 * Returns the sequence of activity check events.
	 *
	 * @returns Sequence of events.
	 */
	getSequence() {
		return this.sequence;
	}

	/**
	 * Checks if a sequence string is valid.
	 *
	 * A sequence is considered valid if it:
	 * - Is a string, separated by {@link ActivityCheckSequence.SEPARATOR}, containing the events to run.
	 * - Has no duplicate events.
	 * - Every event is a valid {@link ActivityCheckEvent}, either a string or number.
	 *
	 * @param sequence The sequence string to validate.
	 * @returns True if the sequence is valid, false otherwise.
	 */
	static isValid(sequence: string) {
		const evtArr = sequence.split(ActivityCheckSequence.SEPARATOR);
		const used = new Set<number>();
		for (const evt of evtArr) {
			let num: number;
			if (typeof ActivityCheckEvent[evt as keyof typeof ActivityCheckEvent] === 'number') {
				num = ActivityCheckEvent[evt as keyof typeof ActivityCheckEvent];
			} else {
				num = parseInt(evt);
				if (ActivityCheckEvent[num] === undefined) return false;
			}
			if (used.has(num)) return false;
			used.add(num);
		}
		return true;
	}
}

//#endregion
