//#region Discord

import {
	EmbedBuilder,
	Interaction,
	InteractionCallbackResponse,
	ButtonInteraction,
	MessageComponentType,
	TextDisplayBuilder,
	ActionRowBuilder,
	MessageActionRowComponentBuilder,
	ButtonBuilder,
	ButtonStyle,
	RepliableInteraction,
	MessageFlags,
	ComponentType,
	InteractionReplyOptions,
} from 'discord.js';
import { client } from '../client.js';
import { Config } from '../config.js';
import { Data } from '../data.js';
import { ActivityCheckSequence } from '../types/activityChecks.js';
import { Errors, ErrorReplies } from '../types/errors.js';
import { Page, CreatePageFunction } from '../types/pagesTypes.js';
import { Debug, reportErrorToUser, constructError } from './errorsUtils.js';

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
	return new EmbedBuilder()
		.setFooter({
			text: `Created by a bot, developed by @${Config.get('appOwnerUsername')}`,
		})
		.setTimestamp();
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
		const allUsers = (await guild.members.fetch()).filter(
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

	async getFormattedPage() {
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
		page.addActionRowComponents(this.getNavButtons());
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
	}: {
		itemsPerPage: number;
		totalItems?: number;
		createPage: CreatePageFunction;
		startingPage?: number;
		cachePages?: boolean;
	}) {
		this.itemsPerPage = itemsPerPage;
		this.totalItems = totalItems;
		this.currentPageI = startingPage;
		this.createPage = (index) => {
			return createPage(index, this.itemsPerPage);
		};
		if (cachePages) {
			throw new Errors.NotAllowedError(
				'Caching pages is currently unsupported due to discord not allowing duplicate custom ids',
			);
		}
		this.cachePages = cachePages;
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
	 */
	async replyTo(interaction: RepliableInteraction, ephemeral = true) {
		const toReply = {
			components: [await this.getFormattedPage()],
			flags: (ephemeral ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
			withResponse: true,
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
			await i.update({ components: [await this.getFormattedPage()], allowedMentions: { roles: [], users: [] } });
		});
	}
}
//#endregion
