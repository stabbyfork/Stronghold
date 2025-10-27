//#region Discord

import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	ContainerBuilder,
	EmbedBuilder,
	Interaction,
	InteractionCallbackResponse,
	InteractionReplyOptions,
	MessageActionRowComponentBuilder,
	MessageComponentType,
	MessageFlags,
	RepliableInteraction,
	SectionBuilder,
	TextDisplayBuilder,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { client } from '../client.js';
import { Data } from '../data.js';
import { ActivityCheckSequence } from '../types/activityChecks.js';
import { ErrorReplies, Errors } from '../types/errors.js';
import { CreatePageFunction, Page } from '../types/pagesTypes.js';
import { constructError, Debug, reportErrorToUser } from './errorsUtils.js';
import { Guild } from '../models/guild.js';
import _ from 'lodash';

/**
 * Creates a default embed for Discord messages.
 *
 * This function returns an instance of `EmbedBuilder` with a default footer
 * and timestamp. The footer indicates the embed was created by a bot and
 * provides the developer's user ID.
 *
 * @returns An instance of `EmbedBuilder` with a default footer and timestamp.
 */
export function defaultEmbed() {
	return (
		new EmbedBuilder()
			/*.setFooter({
			text: `Created by a bot, developed by @${Config.get('appOwnerUsername')}`,
		})*/
			.setTimestamp()
	);
}

export function isSameUser(inter1: Interaction, inter2: Interaction) {
	return inter1.user.id === inter2.user.id;
}

export async function waitForMessageComp(
	response: InteractionCallbackResponse,
	filter: (inter: Interaction) => boolean,
	timeoutS: number,
) {
	try {
		return await response?.resource?.message?.awaitMessageComponent({
			filter: filter,
			time: timeoutS * 1000,
		});
	} catch (e) {
		console.log('Error while waiting for interaction: ', e);
		return;
	}
}

export async function runActivityCheckExecute(
	guildId: string,
	channelId: string,
	currentMessageId: string,
	sequence: string,
) {
	try {
		const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
		if (!guild) {
			Debug.error(`Guild ${guildId} not found`);
			return;
		}
		const channel = await guild.channels.fetch(channelId);
		if (!(channel && channel.isTextBased())) {
			// TODO: Invalidate the activity check and notify
			Debug.error(`Channel ${channelId} not found or not a text channel`);
			return;
		}
		const msg = await channel.messages.fetch(currentMessageId);
		const reactedUsers = new Set(
			(await Promise.all(msg.reactions.cache.map(async (r) => await r.users.fetch())))
				.flatMap((users) => users.map((u) => u.id))
				.filter((u) => u !== client.user?.id),
		);

		const inactiveUsers = new Set<string>();
		const allUsers = (await guild.members.fetch({ time: 10000 })).filter(
			(u) => !(u.id === client.user?.id || u.id === guild.ownerId || u.user.bot),
		);
		allUsers.forEach((u) => {
			if (!reactedUsers.has(u.id)) {
				inactiveUsers.add(u.id);
			}
		});
		const reactedArray = Array.from(reactedUsers);
		await Data.mainDb.transaction(async (transaction) => {
			await Data.models.User.bulkCreate(
				allUsers.map((u) => ({
					guildId: guild.id,
					userId: u.id,
					inactivityStrikes: 0,
				})),
				{
					transaction,
					ignoreDuplicates: true,
				},
			);
			await Data.models.User.increment('inactivityStrikes', {
				where: {
					guildId: guild.id,
				},
				by: 1,
				transaction,
			});
			await Data.models.User.bulkCreate(
				reactedArray.map((u) => ({
					guildId: guild.id,
					userId: u,
					inactivityStrikes: 0,
				})),
				{
					transaction,
					updateOnDuplicate: ['inactivityStrikes'],
				},
			);
			const args = { guild, activeUsers: reactedUsers, inactiveUsers, transaction };
			for (const evt of ActivityCheckSequence.fromString(sequence).getSequence() ?? []) {
				await ActivityCheckSequence.EVENT_HANDLERS[evt](args);
			}
		});
	} catch (e) {
		Debug.error('Error while running activity check:', e, 'Guild:', guildId, 'Channel:', channelId);
	}
}

/**
 * Creates a message component collector and waits for components to be triggered.
 *
 * @param response The callback response of the interaction.
 * @param compType The type of the message component to listen for.
 * @param timeoutS The timeout in seconds.
 * @param callback The callback to call when a component is triggered.
 *
 * @returns Nothing; the collector is created and the callback is called when a
 * component is triggered.
 */
export async function messageCompCollector(
	response: InteractionCallbackResponse,
	timeoutS: number,
	callback: (i: ButtonInteraction) => Promise<void>,
	compType?: MessageComponentType,
) {
	const collector = response?.resource?.message?.createMessageComponentCollector({
		componentType: compType,
		time: timeoutS * 1000,
	});

	if (!collector) {
		Debug.error('Failed to create collector');
		return;
	}

	collector.on('collect', callback);
}

const enum CustomIds {
	PageFirst = 'page-first',
	PagePrevious = 'page-previous',
	PageNext = 'page-next',
	PageLast = 'page-last',
}

export class Pages {
	/**
	 * Unformatted cached pages, not created if `cachePages` is false
	 */
	private readonly pages: Map<number, Page> = new Map();
	private currentPageI = 0;
	readonly itemsPerPage: number;
	private totalItems?: number;
	private readonly createPage: (index: number) => Promise<Page>;
	/**
	 * Whether or not pages should be cached (memory hungry, but faster)
	 */
	private readonly cachePages: boolean;
	/**
	 * Highest page added or visited
	 */
	private highestPage = 0;
	attachments: AttachmentBuilder[] = [];

	/**
	 * The highest page number that can be displayed.
	 *
	 * If the total number of items is not set, this will be `Infinity`.
	 * Otherwise, it is the total number of items divided by the number of items
	 * to display per page, rounded up to the nearest whole number, minus one.
	 */
	get maxPage() {
		if (this.totalItems === undefined) return Infinity;
		return Math.max(Math.ceil(this.totalItems / this.itemsPerPage) - 1, 0);
	}

	async getFormattedPage(includeNavButtons = true) {
		const page = this.cachePages
			? (this.pages.get(this.currentPageI) ??
				(await (async () => {
					const newPage = await this.createPage(this.currentPageI);
					this.pages.set(this.currentPageI, newPage);
					return newPage;
				})()))
			: await this.createPage(this.currentPageI);
		page.spliceComponents(
			0,
			0,
			new TextDisplayBuilder({
				content: `### Page ${this.currentPageI + 1}${this.maxPage !== Infinity ? `/${this.maxPage + 1}` : ''}${this.cachePages ? ' (cached)' : ''}`,
			}),
		);
		if (includeNavButtons) {
			page.addActionRowComponents(this.getNavButtons());
		}
		return page;
	}

	private getNavButtons() {
		const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>();
		const currentPage = this.currentPageI;
		const maxPage = this.maxPage;
		buttons.addComponents(
			new ButtonBuilder()
				.setCustomId(CustomIds.PageFirst)
				.setLabel('⏮')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage === 0),
			new ButtonBuilder()
				.setCustomId(CustomIds.PagePrevious)
				.setLabel('◀')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 0),
			new ButtonBuilder()
				.setCustomId(CustomIds.PageNext)
				.setLabel('▶')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === maxPage),
			new ButtonBuilder()
				.setCustomId(CustomIds.PageLast)
				.setLabel('⏭')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage === maxPage || maxPage === Infinity),
		);
		return buttons;
	}

	private readonly onExpire?: () => Promise<void>;

	/**
	 * Creates a new pagination instance.
	 * @param itemsPerPage The number of items to show per page.
	 * @param totalItems The total number of items.
	 * @param createPage A function that creates a page given the page index and the number of items to show per page.
	 * @param startingPage The page index to start on.
	 * @param cachePages Whether to cache pages or not. Defaults to false.
	 */
	constructor({
		itemsPerPage,
		totalItems,
		createPage,
		startingPage = 0,
		cachePages = false,
		onExpire,
		files = [],
	}: {
		itemsPerPage: number;
		totalItems?: number;
		createPage: CreatePageFunction;
		startingPage?: number;
		cachePages?: boolean;
		onExpire?: () => Promise<void>;
		files?: AttachmentBuilder[];
	}) {
		this.itemsPerPage = itemsPerPage;
		this.totalItems = totalItems;
		this.currentPageI = startingPage;
		this.createPage = (index) => {
			return createPage(index, this.itemsPerPage, this.attachments);
		};
		if (cachePages) {
			throw new Errors.NotAllowedError(
				'Caching pages is currently unsupported due to discord not allowing duplicate custom ids',
			);
		}
		this.cachePages = cachePages;
		this.onExpire = onExpire;
		this.attachments = files;
	}

	setTotalItems(totalItems?: number) {
		this.totalItems = totalItems;
	}

	/**
	 * Sets the page at the given index to the given page.
	 *
	 * @param index The index of the page to set.
	 * @param pageOverwrite The page to overwrite the page at the given index with.
	 * If not given, a new page will be created using the `createPage` function.
	 * @throws {Errors.NotAllowedError} If `cachePages` is false.
	 * @throws {Errors.OutOfBoundsError} If the given index is out of range.
	 */
	async set(index: number, pageOverwrite?: Page) {
		if (!this.cachePages) {
			throw new Errors.NotAllowedError('Cannot set page when cachePages is false');
		}
		if (index < 0 || index > this.maxPage) {
			throw new Errors.OutOfBoundsError(`Page index ${index} is out of range`);
		}
		this.pages.set(index, pageOverwrite ?? (await this.createPage(index)));
		if (index > this.highestPage) {
			this.highestPage = index;
		}
	}

	/**
	 * Appends a page to the end of the pages array.
	 *
	 * If `pageOverwrite` is given, it will be used as the new page. Otherwise, a new
	 * page will be created using the `createPage` function.
	 *
	 * @param pageOverwrite The page to append to the end of the pages array. If not
	 * given, a new page will be created.
	 */
	append(pageOverwrite?: Page) {
		this.set(this.highestPage + 1, pageOverwrite);
	}

	/**
	 * Sets the current page to the given index.
	 *
	 * @param index The index of the page to set as the current page.
	 * @throws {Errors.OutOfBoundsError} If the given index is out of range.
	 */
	setCurrentPage(index: number) {
		if (index < 0 || index > this.maxPage) {
			throw new Errors.OutOfBoundsError(`Page index ${index} is out of range`);
		}
		this.currentPageI = index;
		if (index > this.highestPage) {
			this.highestPage = index;
		}
	}

	shouldDisplayNavButtons() {
		return this.maxPage > 0;
	}

	/**
	 * Replies to the given interaction with the current page.
	 *
	 * A button collector is created with the following IDs:
	 * - `CustomIds.PageFirst`: sets the current page to the first page.
	 * - `CustomIds.PagePrevious`: sets the current page to the previous page.
	 * - `CustomIds.PageNext`: sets the current page to the next page.
	 * - `CustomIds.PageLast`: sets the current page to the last page.
	 *
	 * @param interaction The interaction to reply to.
	 * @param ephemeral Whether or not the response should be ephemeral. Defaults to true.
	 * @param attachmentIndexes The indexes of the attachments to attach to the message (of the attachments member). Defaults to none.
	 */
	async replyTo(interaction: RepliableInteraction, ephemeral = true, attachmentIndexes: number[] = []) {
		const toReply = {
			components: [await this.getFormattedPage(this.shouldDisplayNavButtons())],
			flags: (ephemeral ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
			withResponse: true,
			files: attachmentIndexes.map((index) => this.attachments[index]),
			allowedMentions: {
				roles: [],
				users: [],
			},
		} as const satisfies InteractionReplyOptions;
		const resp =
			interaction.replied || interaction.deferred
				? await interaction.followUp(toReply)
				: (await interaction.reply(toReply)).resource?.message;
		if (!resp) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.NoResponse, ErrorReplies.ReportToOwner]),
				true,
			);
			return;
		}
		const collector = resp.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 3 * 60 * 1000,
			idle: 60 * 1000,
		});
		collector.on('end', async () => {
			collector.removeAllListeners();
			this.pages.clear();
			await this.onExpire?.();
			await resp.edit({
				components: [await this.getFormattedPage(false)],
				allowedMentions: { roles: [], users: [] },
			});
		});
		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await reportErrorToUser(i, constructError([ErrorReplies.NotOwnerOfInteraction]), true);
				return;
			}
			const currentPage = this.currentPageI;
			switch (i.customId) {
				case CustomIds.PageFirst:
					this.setCurrentPage(0);
					break;
				case CustomIds.PagePrevious:
					this.setCurrentPage(currentPage - 1);
					break;
				case CustomIds.PageNext:
					this.setCurrentPage(currentPage + 1);
					break;
				case CustomIds.PageLast:
					this.setCurrentPage(this.maxPage);
					break;
				default:
					throw new Errors.ValueError(`Unknown customId: ${i.customId}`);
			}
			await i.update({
				components: [await this.getFormattedPage(this.shouldDisplayNavButtons())],
				files: attachmentIndexes.map((i) => this.attachments[i]),
				allowedMentions: { roles: [], users: [] },
			});
		});
	}
}

export async function getMessageFromLink(messageLink: string, interaction: ChatInputCommandInteraction, force = false) {
	const match = messageLink.match(/(\d+)\/(\d+)\/(\d+)/);
	if (!match) {
		await reportErrorToUser(
			interaction,
			'You must provide a valid message link. Make sure to mention the bot (@user).',
			true,
		);
		return;
	}
	const [_, guildId, channelId, messageId] = match;
	// May throw
	const sendGuild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
	const channel = sendGuild.channels.cache.get(channelId) ?? (await sendGuild.channels.fetch(channelId));
	if (!channel) {
		await reportErrorToUser(
			interaction,
			'You must provide a valid message link. Make sure to mention the bot (@user).',
			true,
		);
		return;
	}
	if (!channel.isTextBased()) {
		await reportErrorToUser(interaction, 'You must provide a link to a message in a text-based channel.', true);
		return;
	}
	// May throw
	return await channel.messages.fetch({ message: messageId, force });
}

export function getOrFetchGuild(guildId: string) {
	return client.guilds.cache.get(guildId) ?? client.guilds.fetch(guildId);
}

/**
 * Returns a string representing an attachment in the format `attachment://${name}`.
 * @param attachments - The array of attachments.
 * @param index - The index of the attachment to get.
 * @returns The string representing the attachment.
 */
export function getAttachment<A extends AttachmentBuilder[], I extends number>(
	attachments: A,
	index: I,
): `attachment://${A[I]['name']}` {
	return `attachment://${attachments[index].name}`;
}

/**
 * Creates a ContainerBuilder with a list of guilds. Only requires the `tag` and `guildId` fields of the targets
 * @param target - An array of Guild objects to list.
 * @param defaultGuildIcon - An AttachmentBuilder representing the default guild icon.
 * @returns A ContainerBuilder with a list of guilds.
 */
export async function listGuilds(targets: Guild[], defaultGuildIcon: AttachmentBuilder) {
	const guilds = await Promise.all(
		targets.map(async (a) => client.guilds.cache.get(a.guildId) ?? (await client.guilds.fetch(a.guildId))),
	);
	const out = new ContainerBuilder().addTextDisplayComponents((text) => text.setContent('## List of guilds'));
	if (targets.length === 0) {
		out.addTextDisplayComponents((text) => text.setContent('None on this page.'));
		return out;
	}
	const files = [defaultGuildIcon];
	out.addSectionComponents(
		_.zip(guilds, targets).map(([g, t]) => {
			if (!g || !t) throw new Error('Guild (or target) not found');
			const section = new SectionBuilder();
			const icon = g.iconURL();
			if (icon) section.setThumbnailAccessory((image) => image.setURL(icon).setDescription(g.name));
			else
				section.setThumbnailAccessory((image) =>
					image.setDescription(`Default guild icon for ${g.name}`).setURL(getAttachment(files, 0)),
				);
			section.addTextDisplayComponents(
				(text) =>
					text.setContent(
						`### ${g.name}\nTag: \`${t.tag}\` | Members: ${g.memberCount} | Owner: ${userMention(g.ownerId)}`,
					),
				(text) =>
					text.setContent(`-# ID: \`${g.id}\` | Created on: ${time(g.createdAt, TimestampStyles.LongDate)}`),
			);
			return section;
		}),
	);
	return out;
}

/*export namespace CustomIdFormatting {
	export function format(customId: string, data: string[]) {
		let out = customId;
		for (let i = 0; i < data.length; i++) {
			out = customId.replace(`{${i}}`, `"${data[i]}"`);
		}
		return customId;
	}
	export function deformat(formatted: string, original: string) {
		const matches = formatted.matchAll(/"([^"]+)"/g).map((m) => m[1]);
		const out: Map<number, string>;
		for (let i = 0; i < matches.length; i++) {
			
		}
		return out;
	}
}*/

//#endregion
