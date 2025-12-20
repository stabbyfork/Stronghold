import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Collection,
	ForumChannel,
	ForumThreadChannel,
	Guild,
	Interaction,
	MessageActionRowComponentBuilder,
	PermissionFlagsBits,
	ThreadAutoArchiveDuration,
	User,
} from 'discord.js';
import { client } from '../client.js';
import { Data } from '../data.js';
import { GuildRelation, RelatedGuild } from '../models/relatedGuild.js';
import { ErrorReplies, Errors } from '../types/errors.js';
import { InformedCustomId } from '../types/eventTypes.js';
import { defaultEmbed, getOrFetchGuild } from './discordUtils.js';
import { Debug } from './errorsUtils.js';
import { GuildFlag } from './guildFlagsUtils.js';
import { Logging } from './loggingUtils.js';
import { Config } from '../config.js';
import axios from 'axios';

const endpoints = Config.get('news')?.endpoints;

export async function isDiploReady(guild: Guild) {
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
	if (!dbGuild) return false;
	return dbGuild.tag !== null && dbGuild.ready && dbGuild.dpmChannelId !== null;
}

async function getGuildTag(guild: Guild) {
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
	if (!dbGuild) return null;
	return dbGuild.tag;
}

export namespace DPM {
	type DPMChannel = [
		channel: ForumChannel,
		Collection<[firstGuild: string, secondGuild: string], ForumThreadChannel>,
	];
	type Identifier = { source: Guild | Interaction | string; target: Guild | string };
	type CleanIdentifier = { source: Guild; target: Guild; sourceTag: string; targetTag: string };
	type Threads = {
		source: ForumThreadChannel;
		target: ForumThreadChannel;
	};
	export enum TransactionType {
		AllyRequest,
		AllyAccept,
		AllyCancel,
		NeutralQuery,
		NeutralAccept,
		NeutralCancel,
		EnemyDeclare,
		MessageSend,
	}
	type GenericTransaction = { message: string; author: User };
	interface TransactionParams {
		[TransactionType.AllyRequest]: GenericTransaction;
		[TransactionType.NeutralQuery]: GenericTransaction;
		[TransactionType.EnemyDeclare]: GenericTransaction;
		[TransactionType.MessageSend]: GenericTransaction;
		[TransactionType.AllyCancel]: GenericTransaction;
		[TransactionType.NeutralCancel]: GenericTransaction;
		[TransactionType.AllyAccept]: GenericTransaction;
		[TransactionType.NeutralAccept]: GenericTransaction;
	}
	/** name:targetGuildId */
	export enum CustomId {
		AcceptAlly = 'accept-ally',
		DeclineAlly = 'decline-ally',
		CancelAlly = 'cancel-ally',
		AcceptNeutral = 'accept-neutral',
		DeclineNeutral = 'decline-neutral',
		CancelNeutral = 'cancel-neutral',
	}

	for (const val of Object.values(CustomId)) {
		if (!InformedCustomId.isValid(val)) {
			throw new Error(`Invalid transaction type: ${val}`);
		}
	}

	/** Guild ID to channel + guild pairs (lowest string ID first) to thread */
	const channelCache = new Collection<string, DPMChannel>();

	function createTargetActionRow(customIds: [accept: string, decline: string], id: CleanIdentifier) {
		return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel('Accept')
				.setStyle(ButtonStyle.Success)
				.setCustomId(InformedCustomId.format(customIds[0], id.source.id)),
			new ButtonBuilder()
				.setLabel('Decline')
				.setStyle(ButtonStyle.Danger)
				.setCustomId(InformedCustomId.format(customIds[1], id.source.id)),
		);
	}

	function createSourceActionRow(customId: string, id: CleanIdentifier) {
		return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel('Cancel')
				.setStyle(ButtonStyle.Danger)
				.setCustomId(InformedCustomId.format(customId, id.target.id)),
		);
	}

	function sendGenericToThread({
		thread,
		message,
		author,
		title,
		actionRow,
		footer,
	}: {
		thread: ForumThreadChannel;
		message: string;
		author: User;
		title: string;
		actionRow?: ActionRowBuilder<MessageActionRowComponentBuilder>;
		footer?: string;
	}) {
		const embed = defaultEmbed()
			.setAuthor({ name: `${author.globalName} (@${author.username})`, iconURL: author.displayAvatarURL() })
			.setDescription(message /*+ (footer ? `\n\n-# ${footer}` : '')*/)
			.setTitle(title);
		if (footer) embed.setFooter({ text: footer });
		return thread.send({
			embeds: [embed],
			allowedMentions: { users: [], roles: [] },
			components: actionRow ? [actionRow] : [],
		});
	}

	async function setActiveChange(newRelation: GuildRelation | null, id: CleanIdentifier) {
		const dbRelation = await Data.models.RelatedGuild.findOne({
			where: {
				targetGuildId: id.target.id,
				guildId: id.source.id,
			},
		});
		if (!dbRelation) {
			Debug.error(`Guild relation with ${id.source.id} and ${id.target.id} not found in database`);
			return;
		}
		dbRelation.activeChange = newRelation;
		await dbRelation.save();
	}

	async function setRelation(newRelation: GuildRelation, id: CleanIdentifier) {
		await Data.models.RelatedGuild.upsert({
			targetGuildId: id.target.id,
			guildId: id.source.id,
			relation: newRelation,
		});
		await Data.models.RelatedGuild.upsert({
			targetGuildId: id.source.id,
			guildId: id.target.id,
			relation: newRelation,
		});
	}

	const transactionHandlers = {
		[TransactionType.AllyRequest]: async ({ id, params, threads, currentRelation, activeChange }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Ally) throw new Errors.DPMError('You are already allies.');
			if (activeChange) throw new Errors.DPMError(ErrorReplies.RelationChangeInProgress);
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Received ally request`,
				actionRow: createTargetActionRow([CustomId.AcceptAlly, CustomId.DeclineAlly], id),
				footer: `From: ${id.sourceTag}`,
			});
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Sent ally request`,
				actionRow: createSourceActionRow(CustomId.CancelAlly, id),
				footer: `To: ${id.targetTag}`,
			});
			await setActiveChange(GuildRelation.Ally, id);
		},
		[TransactionType.NeutralQuery]: async ({ id, params, threads, currentRelation, activeChange }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Neutral) throw new Errors.DPMError('You are already neutral.');
			if (currentRelation === GuildRelation.Ally) {
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `Broke ties`,
					footer: `From: ${id.sourceTag}`,
				});
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Broke ties`,
					footer: `To: ${id.targetTag}`,
				});
				await setRelation(GuildRelation.Neutral, id);
				await reportRelationChange(id, currentRelation, GuildRelation.Neutral);
			} else if (currentRelation === GuildRelation.Enemy) {
				if (activeChange) throw new Errors.DPMError(ErrorReplies.RelationChangeInProgress);
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Sent peace request`,
					actionRow: createSourceActionRow(CustomId.CancelNeutral, id),
					footer: `To: ${id.targetTag}`,
				});
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `Received peace request`,
					actionRow: createTargetActionRow([CustomId.AcceptNeutral, CustomId.DeclineNeutral], id),
					footer: `From: ${id.sourceTag}`,
				});
				await setActiveChange(GuildRelation.Neutral, id);
			} else {
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Declared neutral`,
					footer: `To: ${id.targetTag}`,
				});
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `Declared neutral`,
					footer: `By: ${id.sourceTag}`,
				});
				await setRelation(GuildRelation.Neutral, id);
				// Don't report, because it's a new relation (null -> neutral)
			}
		},
		[TransactionType.EnemyDeclare]: async ({ id, params, threads, currentRelation }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Enemy) throw new Errors.DPMError('You are already enemies.');
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Declared an enemy`,
				footer: `To: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Declared an enemy`,
				footer: `By: ${id.sourceTag}`,
			});
			await setRelation(GuildRelation.Enemy, id);
			await reportRelationChange(id, currentRelation, GuildRelation.Neutral);
		},
		[TransactionType.MessageSend]: async ({ id, params, threads }) => {
			const { message, author } = params;
			if (message.length == 0) throw new Errors.DPMError(ErrorReplies.MessageTooShort);
			if (message.length > 2000) throw new Errors.DPMError(ErrorReplies.MessageTooLong);
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Sent message`,
				footer: `To: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Received message`,
				footer: `From: ${id.sourceTag}`,
			});
		},
		[TransactionType.AllyCancel]: async ({ id, params, threads }) => {
			const { author, message } = params;
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Cancelled alliance request`,
				footer: `To: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Cancelled alliance request`,
				footer: `By: ${id.sourceTag}`,
			});
			await setActiveChange(null, id);
		},
		[TransactionType.NeutralCancel]: async ({ id, params, threads }) => {
			const { author, message } = params;
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Cancelled peace request`,
				footer: `To: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Cancelled peace request`,
				footer: `By: ${id.sourceTag}`,
			});
			await setActiveChange(null, id);
		},
		[TransactionType.AllyAccept]: async ({ id, params, threads, currentRelation }) => {
			const { author, message } = params;
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Alliance request was accepted`,
				footer: `By: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Accepted alliance request`,
				footer: `From: ${id.sourceTag}`,
			});
			await setRelation(GuildRelation.Ally, id);
			await reportRelationChange(id, currentRelation, GuildRelation.Ally);
			await setActiveChange(null, id);
		},
		[TransactionType.NeutralAccept]: async ({ id, params, threads, currentRelation }) => {
			const { author, message } = params;
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Peace request was accepted`,
				footer: `By: ${id.targetTag}`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Accepted peace request`,
				footer: `From: ${id.sourceTag}`,
			});
			await setRelation(GuildRelation.Neutral, id);
			// Know for sure that existing relation is not neutral
			await reportRelationChange(id, currentRelation, GuildRelation.Neutral);
			await setActiveChange(null, id);
		},
	} as const satisfies {
		[T in TransactionType]: ({
			id,
			params,
			threads,
			currentRelation,
		}: {
			id: CleanIdentifier;
			params: TransactionParams[T];
			threads: Threads;
			currentRelation?: GuildRelation;
			activeChange?: GuildRelation;
			//dbId: DbCleanIdentifier;
		}) => Promise<void>;
	};

	export function createChannel(guild: Guild) {
		return guild.channels.create({
			name: 'diplomacy',
			type: ChannelType.GuildForum,
			parent: guild.systemChannel?.parent ?? undefined,
			topic: 'Diplomacy: requests and messages',
			reason: 'Created default diplomacy channel due to /dpm setup.',
			permissionOverwrites: [
				{
					id: guild.roles.everyone.id,
					deny: PermissionFlagsBits.ViewChannel,
				},
				{
					id: client.user!.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.CreatePublicThreads,
					],
				},
			],
		});
	}

	/**
	 * Gets the diplomacy channel for a guild.
	 * If the channel already exists in the cache, it is returned.
	 * If not, a new channel is created and stored in the cache.
	 * @param guild The guild to get the diplomacy channel for.
	 * @returns A promise that resolves with the diplomacy channel and a collection of threads.
	 */
	export async function getChannel(guild: Guild) {
		const existing = channelCache.get(guild.id);
		if (existing) return existing;
		const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
		if (!dbGuild) throw new Errors.NotFoundError(`Guild with ID \`${guild.id}\` not found in the database.`);
		if (!(await isDiploReady(guild)))
			throw new Error(`Guild with tag \`${dbGuild.tag}\` is not set up for diplomacy.`);

		const channel =
			(guild.channels.cache.get(dbGuild.dpmChannelId!) as ForumChannel | null) ??
			((await guild.channels.fetch(dbGuild.dpmChannelId!)) as ForumChannel | null);
		if (!channel)
			throw new Errors.NotFoundError(`Diplomacy channel for guild with tag \`${dbGuild.tag}\` not found.`);
		const toSet: DPMChannel = [channel, new Collection()];
		channelCache.set(guild.id, toSet);
		return toSet;
	}

	export async function getThreads(data: CleanIdentifier): Promise<Threads> {
		const { source: sourceGuild, target: targetGuild } = data;
		const [sourceChannel, sourceThreads] = await getChannel(sourceGuild);
		const [targetChannel, targetThreads] = await getChannel(targetGuild);
		// Required for sorting in cache
		const sorted: [string, string] =
			sourceGuild.id < targetGuild.id ? [sourceGuild.id, targetGuild.id] : [targetGuild.id, sourceGuild.id];

		let sourceThread = sourceThreads.get(sorted);
		let targetThread = targetThreads.get(sorted);
		if (sourceThread && targetThread) return { source: sourceThread, target: targetThread };
		else {
			const [relation1] = await Data.models.RelatedGuild.findOrCreate({
				where: { guildId: sourceGuild.id, targetGuildId: targetGuild.id },
				defaults: { relation: null, guildId: sourceGuild.id, targetGuildId: targetGuild.id },
			});
			if (!sourceThread) {
				if (relation1.sourceThreadId) {
					sourceThread =
						sourceChannel.threads.cache.get(relation1.sourceThreadId) ??
						(await sourceChannel.threads.fetch(relation1.sourceThreadId)) ??
						undefined;
					if (!sourceThread) {
						Logging.log({
							logType: Logging.Type.Warning,
							data: {
								guildId: sourceGuild.id,
							},
							extents: [GuildFlag.LogWarnings],
							formatData: {
								msg: `Could not find source thread (in this server). It may have been deleted`,
								cause: `Source thread with ID ${relation1.sourceThreadId} not found`,
								action: `Diplomacy between ${sourceGuild.name} and ${targetGuild.name}`,
							},
						});
						throw new Errors.NotFoundError(
							`Source thread with ID ${relation1.sourceThreadId} not found. It may have been deleted.`,
						);
					}
				} else {
					sourceThread = await sourceChannel.threads.create({
						name: `${targetGuild.name}`,
						autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
						message: { content: `Diplomacy between \`${sourceGuild.name}\` and \`${targetGuild.name}\`` },
					});
					await relation1.update({ sourceThreadId: sourceThread.id });
				}
				sourceThreads.set(sorted, sourceThread);
			}
			const [relation2] = await Data.models.RelatedGuild.findOrCreate({
				where: { guildId: targetGuild.id, targetGuildId: sourceGuild.id },
				defaults: { relation: null, guildId: targetGuild.id, targetGuildId: sourceGuild.id },
			});
			if (!targetThread) {
				if (relation2.sourceThreadId) {
					targetThread = targetChannel.threads.cache.get(relation2.sourceThreadId);
					console.log(relation2.sourceThreadId, targetThread);
					if (!targetThread && relation2.sourceThreadId) {
						targetThread = (await targetChannel.threads.fetch(relation2.sourceThreadId)) ?? undefined;
					}
					if (!targetThread) {
						Logging.log({
							logType: Logging.Type.Warning,
							data: {
								guildId: targetGuild.id,
							},
							extents: [GuildFlag.LogWarnings],
							formatData: {
								msg: `Could not find target thread (in this server). It may have been deleted`,
								cause: `Target thread with ID ${relation2.sourceThreadId} not found`,
								action: `Diplomacy between ${sourceGuild.name} and ${targetGuild.name}`,
							},
						});
						throw new Errors.NotFoundError(
							`Target thread with ID ${relation2.sourceThreadId} not found. It may have been deleted.`,
						);
					}
				} else {
					targetThread = await targetChannel.threads.create({
						name: `${sourceGuild.name}`,
						autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
						message: { content: `Diplomacy between \`${targetGuild.name}\` and \`${sourceGuild.name}\`` },
					});
					await relation2.update({ sourceThreadId: targetThread.id });
				}
				targetThreads.set(sorted, targetThread);
			}
		}

		return { source: sourceThread, target: targetThread };
	}

	export async function transaction<T extends TransactionType>(
		id: Identifier,
		tType: T,
		params: TransactionParams[T],
	) {
		const { source, target } = id;
		const cleanSource =
			typeof source === 'string'
				? await getOrFetchGuild(source)
				: source instanceof Guild
					? source
					: source.guild;
		if (!cleanSource) throw new Errors.NotFoundError('Source guild not found');
		const cleanTarget = typeof target === 'string' ? await getOrFetchGuild(target) : target;
		if (cleanSource.id === cleanTarget.id)
			throw new Errors.ValueError('Cannot diplomatise with self (source = target)');
		const tags = await Promise.all([getGuildTag(cleanSource), getGuildTag(cleanTarget)]);
		if (!tags[0]) throw new Errors.NotFoundError('Source guild tag not found');
		if (!tags[1]) throw new Errors.NotFoundError('Target guild tag not found');
		const cleanId: CleanIdentifier = {
			source: cleanSource,
			sourceTag: tags[0],
			target: cleanTarget,
			targetTag: tags[1],
		};
		const threads = await getThreads(cleanId);
		const existingRelation = await Data.models.RelatedGuild.findOne({
			where: { targetGuildId: cleanId.source.id, guildId: cleanId.target.id },
		});
		await transactionHandlers[tType]({
			id: cleanId,
			//-@ts-expect-error Typescript doesn't like this for some reason, but intellisense works ¯\_(ツ)_/¯
			params: params,
			threads,
			currentRelation: existingRelation?.relation ?? undefined,
			activeChange: existingRelation?.activeChange ?? undefined,
		});
	}

	async function reportRelationChange(
		cleanId: CleanIdentifier,
		existingRelation: GuildRelation | undefined,
		newRelation: GuildRelation,
	) {
		if (endpoints?.relationChanges) {
			for (const endpoint of endpoints.relationChanges) {
				axios
					.post(
						endpoint,
						{
							prev: existingRelation ?? null,
							type: newRelation,
							source: cleanId.sourceTag,
							target: cleanId.targetTag,
						},
						{
							headers: {
								'Content-Type': 'application/json',
							},
						},
					)
					.catch((err) => Debug.error(`Error while posting relation change to ${endpoint}: ${err}`));
			}
		}
	}

	export async function tagToGuild(tag: string) {
		const dbGuild = await Data.models.Guild.findOne({ where: { tag } });
		if (!dbGuild) return null;
		return client.guilds.cache.get(dbGuild.guildId) ?? (await client.guilds.fetch(dbGuild.guildId));
	}
}
