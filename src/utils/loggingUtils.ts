//#region Logging

import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ForumChannel,
	ForumThreadChannel,
	Interaction,
	MessageCreateOptions,
	ThreadAutoArchiveDuration,
	TimestampStyles,
	time,
	userMention,
} from 'discord.js';
import { client } from '../client.js';
import { Data } from '../data.js';
import { defaultEmbed } from './discordUtils.js';
import { GuildFlag, GuildFlagBits, GuildFlagField } from './guildFlagsUtils.js';

export namespace Logging {
	export enum Type {
		Default,
		Warning,
		Error,
		Info,
	}
	interface ActionBlame {
		action?: string;
		cause?: string;
		userId?: string;
	}
	//export const Messages = {} as const satisfies { [name: string]: MessageCreateOptions | string };
	const formatters = {
		[Type.Default]: (data: { msg: string }) => ({ content: data.msg, allowedMentions: { users: [], roles: [] } }),
		[Type.Warning]: (data: ActionBlame & { msg: string }) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [
				new EmbedBuilder()
					.setTitle(':warning: Warning')
					.setDescription(data.msg)
					.setColor('Yellow')
					.addFields([
						{ name: 'Action', value: data.action ?? 'Unknown' },
						{ name: 'Cause', value: data.cause ?? 'Unknown' },
						{ name: 'User', value: data.userId ? userMention(data.userId) : 'Unknown' },
					])
					.setTimestamp(),
			],
		}),
		[Type.Error]: (data: ActionBlame & { msg: string }) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [
				new EmbedBuilder()
					.setTitle('❌ Error')
					.setDescription(data.msg)
					.setColor('Red')
					.addFields([
						{ name: 'Action', value: data.action ?? 'Unknown' },
						{ name: 'Cause', value: data.cause ?? 'Unknown' },
						{ name: 'User', value: data.userId ? userMention(data.userId) : 'Unknown' },
					])
					.setTimestamp(),
			],
		}),
		[Type.Info]: (msg: string, interaction?: ChatInputCommandInteraction) => ({
			allowedMentions: { users: [], roles: [] },
			embeds: [
				new EmbedBuilder()
					.setTitle(':information_source: Info')
					.setDescription(msg)
					.addFields(
						interaction
							? [
									{
										name: 'User',
										value: userMention(interaction.user.id),
									},
								]
							: [],
					)
					.setColor('Blue')
					.setTimestamp(),
			],
		}),
	} as const satisfies {
		[t in Type]: (data: any, interaction?: ChatInputCommandInteraction) => MessageCreateOptions | string;
	};

	export const Extents = {
		[GuildFlag.LogAll]: 0b1111,
		[GuildFlag.LogErrors]: 0b1,
		[GuildFlag.LogWarnings]: 0b10,
		[GuildFlag.LogInfo]: 0b100,
		[GuildFlag.LogDebug]: 0b1000,
	} as const satisfies { [K in GuildFlag]?: number };
	export type LogExtent = keyof typeof Extents;
	export function hasExtents(flags: GuildFlagField, ...extents: LogExtent[]) {
		const exts = extents.reduce((acc, extent) => acc | Extents[extent], 0);
		return (
			((Object.keys(Extents) as GuildFlag[])
				.filter((a) => flags & GuildFlagBits[a])
				.reduce((a, b) => a | (Extents[b as LogExtent] ?? 0), 0) &
				exts) ===
			exts
		);
	}

	export const logChannelCache = new Map<string, ForumChannel>();
	export const logExtentsCache = new Map<string, number>();

	function getFormattedDate(date: Date) {
		const day = date.getDate();
		const month = date.getMonth() + 1;
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}
	/**
	 * Gets a thread from the given log channel at the given date.
	 * If the thread does not exist and create is true, a new thread will be created.
	 * If the thread does not exist and create is false, undefined will be returned.
	 * @param logChannel The log channel to get the thread from.
	 * @param t The date to get the thread from.
	 * @param create Whether to create a new thread if the thread does not exist.
	 * @returns The thread at the given date if it exists, or undefined if it does not exist and create is false.
	 * If create is true, the returned thread will be the newly created thread.
	 */
	export async function getThreadAtDay<T extends boolean = false>(
		logChannel: ForumChannel,
		t: Date,
		create: T,
	): Promise<T extends true ? ForumThreadChannel : ForumThreadChannel | undefined> {
		const date = getFormattedDate(t);
		return (logChannel.threads.cache.find((thread) => thread.name === date) ??
			(create
				? await logChannel.threads.create({
						name: getFormattedDate(t),
						autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
						message: { content: 'Logs for ' + time(t, TimestampStyles.LongDate) },
					})
				: undefined)) as T extends true ? ForumThreadChannel : ForumThreadChannel | undefined;
	}
	/**
	 * Gets the current day's log thread from the given log channel.
	 *
	 * If the thread does not exist, it will be created.
	 *
	 * @param logChannel The forum channel to get the thread from.
	 * @returns The current day's log thread.
	 */
	export function getTodayThread(logChannel: ForumChannel) {
		return getThreadAtDay(logChannel, new Date(), true);
	}
	/**
	 * Logs a message to the specified log channel.
	 *
	 * @param data The interaction or guild to log from.
	 * @param logType The type of log to create.
	 * @param formatData The data to format with the log type.
	 * @param extents The log extents to log with.
	 *
	 * @returns A promise that resolves when the log message is sent.
	 */
	export async function log<T extends Type>({
		data,
		logType,
		formatData,
		extents,
	}: {
		data: Interaction | { guildId: string };
		logType: T;
		formatData: Parameters<(typeof formatters)[T]>[0];
		extents: LogExtent[];
	}) {
		let { guildId } = data;
		if (!guildId) return;
		const exts = extents.reduce((acc, extent) => acc | Extents[extent], 0);
		let logChannel = logChannelCache.get(guildId);
		let logExtents = logExtentsCache.get(guildId);
		if (!logChannel) {
			const guild = await Data.models.Guild.findOne({ where: { guildId } });
			if (!guild) return;
			if (!guild.logChannelId) return;
			logChannel = (await client.channels.fetch(guild.logChannelId)) as ForumChannel;
			logChannelCache.set(guildId, logChannel);
		}
		if (!logExtents) {
			const guild = await Data.models.Guild.findOne({ where: { guildId } });
			if (!guild) return;
			const guildFlags = guild.guildFlags;
			logExtents = (Object.keys(Extents) as GuildFlag[])
				.filter((flag) => guildFlags & GuildFlagBits[flag])
				.reduce((acc, flag) => acc | Extents[flag], 0);
			if (logExtents === 0) return;
			logExtentsCache.set(guildId, logExtents);
		}
		if ((logExtents & exts) !== exts) return;
		if (!logChannel) return;
		const todayThread = await getTodayThread(logChannel);
		const intr = data instanceof ChatInputCommandInteraction ? data : undefined;
		const formatted = formatters[logType](formatData as any, intr);
		await todayThread.send(formatted);
	}

	/**
	 * Logs a quick info message to the appropriate log channel for the given interaction.
	 *
	 * This is a shorthand for calling `Logging.log` with the given interaction and message.
	 *
	 * The message will be logged with the `Logging.Type.Info` type and the `GuildFlag.logInfo` extent.
	 *
	 * @param interaction The interaction to get the log channel from.
	 * @param message The message to be logged.
	 */
	export function quickInfo(interaction: Interaction, message: string) {
		Logging.log({
			data: interaction,
			extents: [GuildFlag.LogInfo],
			formatData: message,
			logType: Logging.Type.Info,
		});
	}
}

//#endregion
