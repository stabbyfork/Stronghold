import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	ChatInputCommandInteraction,
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
import { GuildRelation } from '../models/relatedGuild.js';
import { ChangeType } from '../types/diplomacyTypes.js';
import { ErrorReplies, Errors } from '../types/errors.js';
import { InformedCustomId } from '../types/eventTypes.js';
import { defaultEmbed, getOrFetchGuild } from './discordUtils.js';
import { constructError, Debug, reportErrorToUser } from './errorsUtils.js';
import { GuildFlag } from './guildFlagsUtils.js';
import { Logging } from './loggingUtils.js';

export async function isDiploReady(guild: Guild) {
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
	if (!dbGuild) return false;
	return dbGuild.tag !== null && dbGuild.ready && dbGuild.dpmChannelId !== null;
}

export async function changeRelation({
	interaction,
	relationTag,
	changeType,
	newRelation,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType.Add;
	newRelation: GuildRelation;
}): Promise<boolean>;
export async function changeRelation({
	interaction,
	relationTag,
	changeType,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType.Remove;
}): Promise<boolean>;
export async function changeRelation({
	interaction,
	relationTag,
	changeType,
	newRelation,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType;
	newRelation?: GuildRelation;
}): Promise<boolean> {
	const guildId = interaction.guildId;
	if (!guildId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return false;
	}
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guildId } });
	if (!dbGuild) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'Guild not found in database'),
			true,
		);
		return false;
	}
	if (dbGuild.tag === relationTag) {
		await reportErrorToUser(interaction, 'Cannot change relation with the same guild.', true);
		return false;
	}
	await Data.mainDb.transaction(async (transaction) => {
		const targetGuild = await Data.models.Guild.findOne({
			where: { tag: relationTag },
		});
		if (!targetGuild) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.GuildTagNotFound], relationTag), true);
			return false;
		}
		const relations = {
			toTarget: await Data.models.RelatedGuild.findOne({
				where: { guildId: guildId, targetGuildId: targetGuild.guildId },
				transaction,
			}),
			toSource: await Data.models.RelatedGuild.findOne({
				where: { guildId: targetGuild.guildId, targetGuildId: guildId },
				transaction,
			}),
		};
		switch (changeType) {
			case ChangeType.Remove:
				{
					if (!relations.toTarget) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.GuildNotRelated], relationTag),
							true,
						);
						return false;
					}
					if (!relations.toSource) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.GuildNotRelated, ErrorReplies.ReportToOwner], relationTag),
							true,
						);
						return false;
					}

					await dbGuild.removeRelatedGuilds([relations.toTarget.id, relations.toSource.id], { transaction });
				}
				break;
			case ChangeType.Add:
				{
					if (relations.toTarget || relations.toSource) {
						if (
							relations.toTarget?.relation === newRelation ||
							relations.toSource?.relation === newRelation
						) {
							await reportErrorToUser(interaction, 'This guild already has this relation.', true);
							return false;
						}
						await relations.toTarget?.update({ relation: newRelation! }, { transaction });
						await relations.toSource?.update({ relation: newRelation! }, { transaction });
					} else {
						await dbGuild.createRelatedGuild(
							{
								targetGuildId: targetGuild.guildId,
								relation: newRelation!,
							},
							{
								transaction,
							},
						);
						await targetGuild.createRelatedGuild(
							{
								targetGuildId: guildId,
								relation: newRelation!,
							},
							{
								transaction,
							},
						);
					}
				}
				break;
		}
		await dbGuild.save();
	});
	Logging.quickInfo(
		interaction,
		changeType === ChangeType.Add
			? `Changed relation with \`${relationTag}\` to \`${GuildRelation[newRelation!]}\`.`
			: `Removed relation with \`${relationTag}\`.`,
	);
	return true;
}

export namespace DPM {
	type DPMChannel = [
		channel: ForumChannel,
		Collection<[firstGuild: string, secondGuild: string], ForumThreadChannel>,
	];
	type Identifier = { source: Guild | Interaction | string; target: Guild | string };
	type CleanIdentifier = { source: Guild; target: Guild };
	type Threads = {
		source: ForumThreadChannel;
		target: ForumThreadChannel;
	};
	export enum TransactionType {
		AllyRequest,
		AllyCancel,
		NeutralQuery,
		NeutralCancel,
		EnemyDeclare,
		MessageSend,
	}
	type GenericTransaction = { message: string; author: User };
	interface TransactionParams {
		[TransactionType.AllyRequest]: GenericTransaction;
		[TransactionType.NeutralQuery]: GenericTransaction;
		[TransactionType.EnemyDeclare]: GenericTransaction;
		[TransactionType.MessageSend]: GenericTransaction & { sourceTag: string; targetTag: string };
		[TransactionType.AllyCancel]: GenericTransaction;
		[TransactionType.NeutralCancel]: GenericTransaction;
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
	}: {
		thread: ForumThreadChannel;
		message: string;
		author: User;
		title: string;
		actionRow?: ActionRowBuilder<MessageActionRowComponentBuilder>;
	}) {
		const embed = defaultEmbed()
			.setAuthor({ name: author.username, iconURL: author.displayAvatarURL() })
			.setDescription(message)
			.setTitle(title);
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
		[TransactionType.AllyRequest]: async ({ id, params, threads, currentRelation }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Ally) throw new Errors.DPMError('You are already allies.');
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Ally request from \`${id.source.name}\``,
				actionRow: createTargetActionRow([CustomId.AcceptAlly, CustomId.DeclineAlly], id),
			});
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Ally request sent to \`${id.target.name}\``,
				actionRow: createSourceActionRow(CustomId.CancelAlly, id),
			});
			await setActiveChange(GuildRelation.Ally, id);
		},
		[TransactionType.NeutralQuery]: async ({ id, params, threads, currentRelation }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Neutral) throw new Errors.DPMError('You are already neutral.');
			if (currentRelation === GuildRelation.Ally) {
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `\`${id.source.name}\` broke ties`,
				});
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Broke ties with \`${id.target.name}\``,
				});
				await setRelation(GuildRelation.Neutral, id);
			} else if (currentRelation === GuildRelation.Enemy) {
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Sent peace request to \`${id.target.name}\``,
					actionRow: createSourceActionRow(CustomId.CancelNeutral, id),
				});
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `Peace request from \`${id.source.name}\``,
					actionRow: createTargetActionRow([CustomId.AcceptNeutral, CustomId.DeclineNeutral], id),
				});
				await setActiveChange(GuildRelation.Neutral, id);
			} else {
				await sendGenericToThread({
					thread: threads.source,
					message,
					author,
					title: `Marked \`${id.target.name}\` neutral`,
				});
				await sendGenericToThread({
					thread: threads.target,
					message,
					author,
					title: `Neutrality declaration from \`${id.source.name}\``,
				});
				await setRelation(GuildRelation.Neutral, id);
			}
		},
		[TransactionType.EnemyDeclare]: async ({ id, params, threads, currentRelation }) => {
			const { message, author } = params;
			if (currentRelation === GuildRelation.Enemy) throw new Errors.DPMError('You are already enemies.');
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Declared \`${id.target.name}\` an enemy`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Enemy declaration from \`${id.source.name}\``,
			});
			await setRelation(GuildRelation.Enemy, id);
		},
		[TransactionType.MessageSend]: async ({ id, params, threads }) => {
			const { message, author, targetTag, sourceTag } = params;
			await sendGenericToThread({
				thread: threads.source,
				message,
				author,
				title: `Sent message to \`${id.target.name}\` (\`${targetTag}\`)`,
			});
			await sendGenericToThread({
				thread: threads.target,
				message,
				author,
				title: `Message from \`${id.source.name}\` (\`${sourceTag}\`)`,
			});
		},
		[TransactionType.AllyCancel]: async ({ id, params, threads }) => {
			const { author } = params;
			await sendGenericToThread({
				thread: threads.source,
				message: 'No reason can be provided.',
				author,
				title: `Cancelled ally request to \`${id.target.name}\``,
			});
			await sendGenericToThread({
				thread: threads.target,
				message: 'No reason can be provided.',
				author,
				title: `Ally request from \`${id.source.name}\` was cancelled`,
			});
			await setActiveChange(null, id);
		},
		[TransactionType.NeutralCancel]: async ({ id, params, threads }) => {
			const { author } = params;
			await sendGenericToThread({
				thread: threads.source,
				message: 'No reason can be provided.',
				author,
				title: `Cancelled peace request to \`${id.target.name}\``,
			});
			await sendGenericToThread({
				thread: threads.target,
				message: 'No reason can be provided.',
				author,
				title: `Peace request from \`${id.source.name}\` was cancelled`,
			});
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
				defaults: { relation: GuildRelation.Neutral, guildId: sourceGuild.id, targetGuildId: targetGuild.id },
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
						name: `${sourceGuild.name} - ${targetGuild.name}`,
						autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
						message: { content: `Diplomacy between \`${sourceGuild.name}\` and \`${targetGuild.name}\`` },
					});
					await relation1.update({ sourceThreadId: sourceThread.id });
				}
				sourceThreads.set(sorted, sourceThread);
			}
			const [relation2] = await Data.models.RelatedGuild.findOrCreate({
				where: { guildId: targetGuild.id, targetGuildId: sourceGuild.id },
				defaults: { relation: GuildRelation.Neutral, guildId: targetGuild.id, targetGuildId: sourceGuild.id },
			});
			if (!targetThread) {
				if (relation2.sourceThreadId) {
					targetThread =
						sourceChannel.threads.cache.get(relation2.sourceThreadId) ??
						(await sourceChannel.threads.fetch(relation2.sourceThreadId)) ??
						undefined;
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
						name: `${targetGuild.name} - ${sourceGuild.name}`,
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
		const cleanId: CleanIdentifier = {
			source: cleanSource,
			target: cleanTarget,
		};
		const threads = await getThreads(cleanId);
		const existingRelation = await Data.models.RelatedGuild.findOne({
			where: { targetGuildId: cleanId.source.id, guildId: cleanId.target.id },
		});
		await transactionHandlers[tType]({
			id: cleanId,
			//@ts-expect-error Typescript doesn't like this for some reason, but intellisense works ¯\_(ツ)_/¯
			params: params,
			threads,
			currentRelation: existingRelation?.relation,
		});
	}

	export async function tagToGuild(tag: string) {
		const dbGuild = await Data.models.Guild.findOne({ where: { tag } });
		if (!dbGuild) return null;
		return client.guilds.cache.get(dbGuild.guildId) ?? (await client.guilds.fetch(dbGuild.guildId));
	}
}
