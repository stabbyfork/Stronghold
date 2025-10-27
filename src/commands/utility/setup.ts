import { Transaction } from '@sequelize/core';
import {
	ButtonBuilder,
	ButtonStyle,
	channelMention,
	ChannelSelectMenuBuilder,
	ChannelType,
	ContainerBuilder,
	Guild,
	MessageFlags,
	PermissionFlagsBits,
	Role,
	roleMention,
	RoleSelectMenuBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	TextChannel,
	time,
	TimestampStyles,
	User,
	userMention,
	UserSelectMenuBuilder,
} from 'discord.js';
import _ from 'lodash';
import { client } from '../../client.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { UserAssociations } from '../../models/user.js';
import { createCommand } from '../../types/commandTypes.js';
import { ErrorReplies, Errors } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, Debug, reportErrorToUser } from '../../utils/errorsUtils.js';
import { GuildFlag, GuildFlagBits } from '../../utils/guildFlagsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { Permission, PermissionBits } from '../../utils/permissionsUtils.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { Usages, UsageScope } from '../../utils/usageLimitsUtils.js';

const enum RoleNames {
	InSession = 'In Session',
	Inactive = 'Inactive',
}

/**
 * Creates the default Inactive role if it does not exist yet.
 * @param guild The guild to create the role in.
 * @returns The created role, or undefined if no role was created.
 */
export async function createInactiveRoleIfMissing(guild: Guild, transaction: Transaction) {
	const prevInactiveRole = (
		await Data.models.Guild.findOne({
			where: {
				guildId: guild.id,
			},
			attributes: ['inactiveRoleId'],
			transaction,
		})
	)?.inactiveRoleId;
	let role: Role | null = null;
	if (prevInactiveRole) {
		role = guild.roles.cache.get(prevInactiveRole) ?? (await guild.roles.fetch(prevInactiveRole));
	}
	if (!prevInactiveRole || !role) {
		const created = await guild.roles.create({
			name: RoleNames.Inactive,
			permissions: [],
			color: [60, 60, 60],
			reason: 'Default Inactive role created during setup',
		});
		if (!created) return undefined;
		return created;
	}
	return role;
}

export async function createInSessionRoleIfMissing(guild: Guild, transaction: Transaction) {
	const prevInSessionRole = (
		await Data.models.Guild.findOne({
			where: {
				guildId: guild.id,
			},
			attributes: ['inSessionRoleId'],
			transaction,
		})
	)?.inSessionRoleId;
	let role: Role | null = null;
	if (prevInSessionRole) {
		role = guild.roles.cache.get(prevInSessionRole) ?? (await guild.roles.fetch(prevInSessionRole));
	}
	if (!prevInSessionRole || !role) {
		const created = await guild.roles.create({
			name: RoleNames.InSession,
			permissions: [],
			color: [60, 60, 200],
			reason: 'Default in-session role created during setup',
		});
		if (!created) return undefined;
		return created;
	}
	return role;
}

const enum CustomIds {
	Ready = 'ready',
	SetAdminUsers = 'admin-users',
	SetAdminRoles = 'admin-roles',
	CreateLogChannel = 'create-log-channel',
	SetLogChannel = 'set-log-channel',
	InactiveUseExisting = 'inactive-use-existing',
	InactiveCreate = 'inactive-create-new',
	LogExtent = 'log-extent',
	InSessionUseExisting = 'in-session-use-existing',
	InSessionCreate = 'in-session-create-new',
}

interface SetupConfig {
	logChannel?: string;
	adminRoles: string[];
	adminUsers: string[];
	inactiveRole?: Role;
	inSessionRole?: Role;
	createInactive: boolean;
	createInSession: boolean;
	useExistingInactive: boolean;
	useExistingInSession: boolean;
	createLogChannel: boolean;
	logExtents: Logging.LogExtent[];
}

async function createSetupMessage(
	guild: Guild,
	config: SetupConfig,
	force: boolean,
	user: User,
): Promise<[message: ContainerBuilder, existingInactiveRoleId: string | null, existingInSessionRoleId: string | null]> {
	const message = new ContainerBuilder({ accent_color: 0x0033ff }).addSectionComponents((section) =>
		section
			.addTextDisplayComponents(
				(text) => text.setContent('## Setup'),
				(text) =>
					text.setContent(
						`This will set up the bot for this server. You (the server owner) will be made a bot administrator automatically. Only you (the server owner) can add or remove bot administrators. This will create the \`${RoleNames.InSession}\` and \`${RoleNames.Inactive}\` roles if they have not been added yet.`,
					),
				(text) => text.setContent(`All choices are applied when you click \`Start setup\`.`),
			)
			.setThumbnailAccessory((image) => image.setURL(guild.iconURL() ?? client.user?.avatarURL()!)),
	);
	if (force) {
		message.addTextDisplayComponents((text) =>
			text.setContent('**Note**: This will overwrite some features if enabled during the previous setup.'),
		);
	}
	message
		.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large).setDivider(false))
		.addTextDisplayComponents((text) =>
			text.setContent(
				`Choose members to grant bot administrator (bot-specific, **NOT SERVER-WIDE ADMINISTRATOR**) permissions (the server owner is always a bot administrator):`,
			),
		)
		.addActionRowComponents((actRow) =>
			actRow.addComponents(
				new UserSelectMenuBuilder()
					.setCustomId(CustomIds.SetAdminUsers)
					.setPlaceholder('Up to 16 users to be granted admin')
					.setMinValues(0)
					.setMaxValues(16),
			),
		)
		.addTextDisplayComponents((text) => text.setContent('Choose roles to grant bot administrator permissions:'))
		.addActionRowComponents((actRow) =>
			actRow.addComponents(
				new RoleSelectMenuBuilder()
					.setCustomId(CustomIds.SetAdminRoles)
					.setPlaceholder('Up to 16 roles to be granted admin')
					.setMinValues(0)
					.setMaxValues(16),
			),
		)
		.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large))
		.addSectionComponents((sect) =>
			sect
				.addTextDisplayComponents((text) =>
					text.setContent(
						`Choose a **forum** channel (the one with posts) to send logs to. This is highly recommended to easily diagnose issues and monitor events. A channel may be automatically created by clicking the \`Create new\` button. **If empty (no channel selected) AND no channel is to be created, no logs will be sent:**`,
					),
				)
				.setButtonAccessory((button) =>
					button
						.setLabel(`${config.createLogChannel ? '✔ ' : ''}Create new`)
						.setStyle(ButtonStyle.Primary)
						.setCustomId(CustomIds.CreateLogChannel),
				),
		)
		.addActionRowComponents((actRow) =>
			actRow.addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId(CustomIds.SetLogChannel)
					.setPlaceholder('Channel to send logs to')
					.setMinValues(0)
					.setMaxValues(1)
					.setChannelTypes(ChannelType.GuildForum)
					.setDisabled(config.createLogChannel),
			),
		)
		.addTextDisplayComponents((text) => text.setContent('Choose what to log (you can choose multiple):'))
		.addActionRowComponents((actRow) =>
			actRow.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(CustomIds.LogExtent)
					.setPlaceholder('Select logging categories')
					.setMinValues(1)
					.setMaxValues(Object.keys(Logging.Extents).length)
					.addOptions(
						Object.keys(Logging.Extents).map((e) =>
							e === GuildFlag.LogAll
								? {
										label: 'Log Everything',
										value: e,
										description: 'Recommended!',
										default: config.logExtents.includes(e as GuildFlag),
									}
								: {
										label: _.startCase(e),
										value: e,
										default: config.logExtents.includes(e as GuildFlag),
									},
						),
					)
					.setDisabled(!config.createLogChannel && !config.logChannel),
			),
		);

	let existingInactiveId: string | null = null;
	const existingInactive = await guild.roles
		.fetch()
		.then((roles) => roles.find((r) => r.name === RoleNames.Inactive));
	if (existingInactive) {
		existingInactiveId = existingInactive.id;
		message
			.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large))
			.addTextDisplayComponents((text) =>
				text.setContent(
					`:warning: An existing role named \`${existingInactive.name}\` (${roleMention(existingInactive.id)}) was found. Would you like to integrate this role, to be given to members who are marked inactive due to failing to react to an activity check, or create a new role for this purpose?`,
				),
			)
			.addActionRowComponents((actRow) =>
				actRow.addComponents(
					new ButtonBuilder()
						.setCustomId(CustomIds.InactiveUseExisting)
						.setLabel(`${config.useExistingInactive ? '✔ ' : ''}Use existing`)
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(CustomIds.InactiveCreate)
						.setLabel(`${config.createInactive ? '✔ ' : ''}Create new`)
						.setStyle(ButtonStyle.Secondary),
				),
			);
	}

	let existingInSessionId: string | null = null;
	const existingInSession = await guild.roles
		.fetch()
		.then((roles) => roles.find((r) => r.name === RoleNames.InSession));
	if (existingInSession) {
		existingInSessionId = existingInSession.id;
		message
			.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large))
			.addTextDisplayComponents((text) =>
				text.setContent(
					`:warning: An existing role named \`${existingInSession.name}\` (${roleMention(existingInSession.id)}) was found. Would you like to integrate this role, to be given to members who are in a session, or create a new role for this purpose?`,
				),
			)
			.addActionRowComponents((actRow) =>
				actRow.addComponents(
					new ButtonBuilder()
						.setCustomId(CustomIds.InSessionUseExisting)
						.setLabel(`${config.useExistingInSession ? '✔ ' : ''}Use existing`)
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(CustomIds.InSessionCreate)
						.setLabel(`${config.createInSession ? '✔ ' : ''}Create new`)
						.setStyle(ButtonStyle.Secondary),
				),
			);
	}

	message.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large));
	message.addActionRowComponents((actRow) =>
		actRow.addComponents(
			new ButtonBuilder().setCustomId(CustomIds.Ready).setLabel('Start setup').setStyle(ButtonStyle.Success),
		),
	);
	message.addTextDisplayComponents((text) =>
		text.setContent(
			`-# Requested by ${userMention(user.id)} ${time(new Date(), TimestampStyles.RelativeTime)} at ${time(new Date(), TimestampStyles.ShortTime)}`,
		),
	);
	return [message, existingInactiveId, existingInSessionId];
}

export default createCommand<typeof commandOptions.setup>({
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Set up the bot for the first time. Server owner only, for security reasons.')
		.addBooleanOption((option) =>
			option
				.setName('force')
				.setDescription('Force setup, even if completed previously. This may overwrite some data.'),
		),
	execute: async (interaction, args) => {
		const guild = interaction.guild;
		if (!guild) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
			return;
		}
		const channel = interaction.channel;
		if (!channel) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoChannel]), true);
			return;
		}
		const user = interaction.user;
		if (user.id !== guild.ownerId) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.MustBeServerOwner]), true);
			Usages.guildAll(guild.id).get('setup')?.addUse();
			return;
		}

		const existingInst = await Data.models.Guild.findOne({
			where: {
				guildId: guild.id,
			},
		});
		const force = getOption(interaction, args, 'force') ?? false;
		if (existingInst !== null && !force && existingInst.ready) {
			await reportErrorToUser(interaction, constructError([ErrorReplies.SetupAlreadyComplete]), true);
			return;
		}

		const setupConfig: SetupConfig = {
			logChannel: undefined,
			adminRoles: [],
			adminUsers: [],
			inactiveRole: undefined,
			createInactive: false,
			useExistingInactive: false,
			createLogChannel: false,
			logExtents: [GuildFlag.LogAll],
			createInSession: false,
			useExistingInSession: false,
			inSessionRole: undefined,
		};

		const [message, existingInactiveId, existingInSessionId] = await createSetupMessage(
			guild,
			setupConfig,
			force,
			user,
		);
		if (!existingInactiveId) setupConfig.createInactive = true;
		if (!existingInSessionId) setupConfig.createInSession = true;

		const resp = await interaction.reply({
			components: [message],
			flags: [MessageFlags.IsComponentsV2],
			withResponse: true,
			allowedMentions: {
				roles: [],
				users: [],
			},
		});
		const collector = resp.resource?.message?.createMessageComponentCollector({
			time: 5 * 60 * 1000,
		});
		if (!collector) {
			await reportErrorToUser(
				interaction,
				constructError([ErrorReplies.CouldNotCreateCollector, ErrorReplies.ReportToOwner]),
				true,
			);
			return;
		}
		collector.on('end', async () => {
			collector.removeAllListeners();
		});

		async function updateReply() {
			await interaction.editReply({
				components: [(await createSetupMessage(guild!, setupConfig, force, user))[0]],
				allowedMentions: {
					roles: [],
					users: [],
				},
			});
		}

		let isReady = false;
		collector.on('collect', async (i) => {
			if (i.user.id !== user.id) {
				i.reply({
					content: 'You are not allowed to interact with this, as you did not request this setup.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			switch (i.customId) {
				case CustomIds.Ready:
					i.deferUpdate();
					isReady = true;
					// Fix for an edge case where the role is deleted during the setup process and neither button can be pressed
					if (
						!(existingInactiveId && guild.roles.cache.get(existingInactiveId)) &&
						!(setupConfig.createInactive || setupConfig.useExistingInactive)
					) {
						setupConfig.createInactive = true;
					} else if (setupConfig.useExistingInactive && setupConfig.createInactive) {
						await reportErrorToUser(
							interaction,
							"Somehow, both 'use existing inactive role' and 'create inactive role' were chosen. Please click one of the buttons and report this to the owner.",
						);
						return;
					} else if (!(setupConfig.useExistingInactive || setupConfig.createInactive)) {
						await reportErrorToUser(
							interaction,
							'You must choose to either create or use an existing role for inactive members.',
						);
						return;
					}

					if (
						!(existingInSessionId && guild.roles.cache.get(existingInSessionId)) &&
						!(setupConfig.createInSession || setupConfig.useExistingInSession)
					) {
						setupConfig.createInSession = true;
					} else if (setupConfig.useExistingInSession && setupConfig.createInSession) {
						await reportErrorToUser(
							interaction,
							"Somehow, both 'use existing in-session role' and 'create in-session role' were chosen. Please click one of the buttons and report this to the owner.",
						);
						return;
					} else if (!(setupConfig.useExistingInSession || setupConfig.createInSession)) {
						await reportErrorToUser(
							interaction,
							'You must choose to either create or use an existing role for members in a session.',
						);
						return;
					}
					return collector.stop(CustomIds.Ready);
				case CustomIds.CreateLogChannel:
					setupConfig.createLogChannel = !setupConfig.createLogChannel;
					/*if (setupConfig.createLogChannel) {
						await i.reply({
							embeds: [
								defaultEmbed()
									.setTitle('Success')
									.setColor('Green')
									.setDescription('A new channel will be created for logging.'),
							],
							flags: MessageFlags.Ephemeral,
						});
					} else {
						await i.reply({
							embeds: [
								defaultEmbed()
									.setTitle('Success')
									.setColor('Green')
									.setDescription('A new channel will **not** be created for logging.'),
							],
							flags: MessageFlags.Ephemeral,
						});
					}*/
					i.deferUpdate();
					updateReply();
					break;
				case CustomIds.InactiveCreate:
					setupConfig.createInactive = true;
					setupConfig.useExistingInactive = false;
					/*await i.reply({
						embeds: [
							defaultEmbed()
								.setTitle('Success')
								.setColor('Green')
								.setDescription('A new role will created for inactive members.'),
						],
						flags: MessageFlags.Ephemeral,
					});*/
					i.deferUpdate();
					updateReply();
					break;
				case CustomIds.InactiveUseExisting:
					// This really shouldn't happen
					if (!existingInactiveId || !guild.roles.cache.has(existingInactiveId)) {
						await i.reply({
							embeds: [
								defaultEmbed()
									.setTitle('Error')
									.setColor('Red')
									.setDescription('No existing role found for inactive members.'),
							],
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
					setupConfig.createInactive = false;
					setupConfig.useExistingInactive = true;
					setupConfig.inactiveRole = guild.roles.cache.get(existingInactiveId);
					/*await i.reply({
						embeds: [
							defaultEmbed()
								.setTitle('Success')
								.setColor('Green')
								.setDescription(
									'Existing role for inactive members found and will be integrated: ' +
										roleMention(existingInactiveId),
								),
						],
						flags: MessageFlags.Ephemeral,
					});*/
					i.deferUpdate();
					updateReply();
					break;
				case CustomIds.SetAdminUsers:
					if (!i.isUserSelectMenu()) {
						throw new TypeError(`Expected UserSelectMenu, got ${i.type}`);
					}
					setupConfig.adminUsers = i.values;
					if (setupConfig.adminUsers.length === 0) {
						await i.reply({
							embeds: [
								defaultEmbed()
									.setTitle('Success')
									.setColor('Green')
									.setDescription(
										`**Only** ${userMention(user.id)} will be given admin permissions.`,
									),
							],
							flags: MessageFlags.Ephemeral,
						});
					} else {
						i.deferUpdate();
					}
					break;
				case CustomIds.SetAdminRoles:
					if (!i.isRoleSelectMenu()) {
						throw new TypeError(`Expected RoleSelectMenu, got ${i.type}`);
					}
					setupConfig.adminRoles = i.values;
					/*await i.reply({
						embeds: [
							defaultEmbed()
								.setTitle('Success')
								.setColor('Green')
								.setDescription(
									setupConfig.adminRoles.length === 0
										? `No roles will be given admin permissions.`
										: `Roles ${setupConfig.adminRoles.map(roleMention).join(', ')} will be given admin permissions.`,
								),
						],
						flags: MessageFlags.Ephemeral,
					});*/
					i.deferUpdate();
					break;
				case CustomIds.SetLogChannel:
					if (!i.isChannelSelectMenu()) {
						throw new TypeError(`Expected ChannelSelectMenu, got ${i.type}`);
					}
					setupConfig.logChannel = i.values[0];
					/*await i.reply({
						embeds: [
							defaultEmbed()
								.setTitle('Success')
								.setColor('Green')
								.setDescription(
									setupConfig.logChannel
										? `Log channel set to ${channelMention(setupConfig.logChannel)}`
										: `Unset log channel`,
								),
						],
						flags: MessageFlags.Ephemeral,
					});*/
					i.deferUpdate();
					updateReply();
					break;
				case CustomIds.LogExtent:
					if (!i.isStringSelectMenu()) {
						throw new TypeError(`Expected StringSelectMenu, got ${i.type}`);
					}
					setupConfig.logExtents = i.values as Logging.LogExtent[];
					i.deferUpdate();
					break;
				case CustomIds.InSessionCreate:
					setupConfig.createInSession = true;
					setupConfig.useExistingInSession = false;
					i.deferUpdate();
					updateReply();
					break;
				case CustomIds.InSessionUseExisting:
					// This really shouldn't happen
					if (!existingInSessionId || !guild.roles.cache.has(existingInSessionId)) {
						await i.reply({
							embeds: [
								defaultEmbed()
									.setTitle('Error')
									.setColor('Red')
									.setDescription('No existing role found for inactive members.'),
							],
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
					setupConfig.createInSession = false;
					setupConfig.useExistingInSession = true;
					setupConfig.inSessionRole = guild.roles.cache.get(existingInSessionId);
					i.deferUpdate();
					updateReply();
					break;
				default:
					throw new Errors.ValueError(`Unknown customId: ${i.customId}`);
			}
		});

		const ended = new Promise<boolean>((resolve) => {
			collector?.on('end', () => {
				if (isReady) resolve(true);
				else resolve(false);
			});
		});
		if (!(await ended)) {
			await resp.resource?.message?.edit({
				components: [
					new ContainerBuilder({ accent_color: 0xff0000 }).addTextDisplayComponents(
						(text) => text.setContent('## Timed out'),
						(text) => text.setContent('This setup has timed out.'),
					),
				],
			});
			return;
		}

		const endReplyMsg = new ContainerBuilder({ accent_color: 0x00ff00 }).addTextDisplayComponents(
			(text) => text.setContent('## Setup complete!'),
			(text) => text.setContent('Most bot commands are now available.'),
			(text) =>
				text.setContent(
					'You may use `/help` to view all available commands. Some commands have extra information about their usage. To get help on a specific command, use `/help <command>`.',
				),
			(text) =>
				text.setContent(
					'Next steps:\n- View all commands using \`/help\`\n- Set up diplomacy using \`/dpm setup\`\n- Add ranks using \`/ranking ranks add\`',
				),
			(text) =>
				text.setContent("If you have any questions, please join our support server! (linked in the bot's bio)"),
		);

		if (setupConfig.createLogChannel) {
			setupConfig.logChannel = (
				await guild.channels.create({
					name: 'logs',
					type: ChannelType.GuildForum,
					reason: 'Automatically created by /setup command on request by server owner.',
					parent: guild.systemChannel ? guild.systemChannel.parent : (channel as TextChannel).parent,
					topic: 'Logs for this server.',
					permissionOverwrites: [
						{
							id: guild.roles.everyone,
							deny: [PermissionFlagsBits.ViewChannel],
						},
						{
							id: client.user!.id,
							allow: [PermissionFlagsBits.ViewChannel],
						},
					],
				})
			).id;
			endReplyMsg.addTextDisplayComponents((text) =>
				text.setContent(`Channel created: ${channelMention(setupConfig.logChannel!)}`),
			);
		}

		await Data.mainDb
			.transaction(async (transaction) => {
				await Data.models.Guild.upsert({
					guildId: guild.id,
					ready: false,
				});
				if (setupConfig.createInactive) {
					const role = await createInactiveRoleIfMissing(guild, transaction);
					if (!role) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.UnknownError, ErrorReplies.ReportToOwner]),
							true,
						);
						throw new Errors.ThirdPartyError('Failed to create inactive role');
					}
					setupConfig.inactiveRole = role;
					endReplyMsg.addTextDisplayComponents((text) =>
						text.setContent(`Inactive role created: ${roleMention(setupConfig.inactiveRole!.id)}`),
					);
				}

				if (setupConfig.createInSession) {
					const role = await createInSessionRoleIfMissing(guild, transaction);
					if (!role) {
						reportErrorToUser(
							interaction,
							constructError([ErrorReplies.UnknownError, ErrorReplies.ReportToOwner]),
							true,
						);
						throw new Errors.ThirdPartyError('Failed to create in-session role');
					}
					setupConfig.inSessionRole = role;
					endReplyMsg.addTextDisplayComponents((text) =>
						text.setContent(`In-session role created: ${roleMention(setupConfig.inSessionRole!.id)}`),
					);
				}

				if (!setupConfig.adminUsers.includes(user.id)) setupConfig.adminUsers.push(user.id);
				await Data.models.User.bulkCreate(
					setupConfig.adminUsers.map((id) => ({
						userId: id,
						guildId: guild.id,
					})),
					{ ignoreDuplicates: true, transaction },
				);
				const admUsers = await Data.models.User.findAll({
					where: {
						guildId: guild.id,
						userId: setupConfig.adminUsers,
					},
					include: [UserAssociations.UserPermission],
					transaction,
				});
				await Promise.all(
					admUsers.map(async (usr) => {
						if (usr.userPermission) {
							usr.userPermission.permissions |= PermissionBits[Permission.Administrator];
							await usr.userPermission.save({ transaction });
						} else {
							await usr.createUserPermission(
								{
									guildId: guild.id,
									permissions: PermissionBits[Permission.Administrator],
								},
								{
									transaction,
								},
							);
						}
					}),
				);

				endReplyMsg.addTextDisplayComponents((text) => {
					const users = new Set([user.id, ...setupConfig.adminUsers]);
					return text.setContent(
						`${users.size === 1 ? 'User' : 'Users'} ${[...users].map(userMention).join(', ')} ${users.size === 1 ? 'has' : 'have'} been given admin permissions.`,
					);
				});

				if (setupConfig.adminRoles.length > 0) {
					await Promise.all(
						setupConfig.adminRoles.map(async (id) => {
							const prevPerms = await Data.models.RolePermission.findOne({
								where: {
									guildId: guild.id,
									roleId: id,
								},
							});
							if (prevPerms) {
								prevPerms.permissions |= PermissionBits[Permission.Administrator];
								await prevPerms.save({ transaction });
							} else {
								await Data.models.RolePermission.create(
									{
										guildId: guild.id,
										roleId: id,
										permissions: PermissionBits[Permission.Administrator],
									},
									{
										transaction,
									},
								);
							}
						}),
					);
					endReplyMsg.addTextDisplayComponents((text) =>
						text.setContent(
							`Roles ${setupConfig.adminRoles.map(roleMention).join(', ')} have been given admin permissions.`,
						),
					);
				}

				if (setupConfig.logChannel) {
					const prevData = await Data.models.Guild.findOne({ where: { guildId: guild.id }, transaction });
					if (setupConfig.logExtents.length === 0) {
						await reportErrorToUser(
							interaction,
							'You must provide at least one category to log if a logging channel is chosen (or to be created).',
							true,
						);
						throw new Errors.HandledError('User must provide at least one category to log');
					}
					const bits = setupConfig.logExtents.reduce((a, b) => a | GuildFlagBits[b], 0);
					if (prevData) {
						prevData.guildFlags = bits;
						prevData.logChannelId = setupConfig.logChannel;
						await prevData.save({ transaction });
					} else {
						await Data.models.Guild.create(
							{
								guildId: guild.id,
								ready: false,
								guildFlags: GuildFlagBits[GuildFlag.LogAll],
								logChannelId: setupConfig.logChannel,
							},
							{ transaction },
						);
					}
					const chosenExtents: string[] = [];
					for (const ext of setupConfig.logExtents) {
						if (ext === GuildFlag.LogAll) {
							chosenExtents.push('everything');
							break;
						}
						switch (ext) {
							case GuildFlag.LogDebug:
								chosenExtents.push('debug');
								break;
							case GuildFlag.LogErrors:
								chosenExtents.push('errors');
								break;
							case GuildFlag.LogInfo:
								chosenExtents.push('info');
								break;
							case GuildFlag.LogWarnings:
								chosenExtents.push('warnings');
								break;
							default:
								// In case something was forgotten
								chosenExtents.push(ext);
								Debug.error(`Unknown log extent: ${ext}`);
						}
					}
					Logging.logChannelCache.delete(guild.id);
					Logging.logExtentsCache.delete(guild.id);
					endReplyMsg.addTextDisplayComponents(
						(text) => text.setContent(`Log channel set to ${channelMention(setupConfig.logChannel!)}`),
						(text) =>
							text.setContent(
								'The following events/categories will be logged: ' +
									chosenExtents.map((s) => `\`${s}\``).join(', ') +
									'.',
							),
					);
				}

				if (setupConfig.useExistingInactive && setupConfig.inactiveRole) {
					endReplyMsg.addTextDisplayComponents((text) =>
						text.setContent(`Inactive role set to ${roleMention(setupConfig.inactiveRole!.id)}`),
					);
				}

				if (setupConfig.useExistingInSession && setupConfig.inSessionRole) {
					endReplyMsg.addTextDisplayComponents((text) =>
						text.setContent(`In-session role set to ${roleMention(setupConfig.inSessionRole!.id)}`),
					);
				}

				await Data.models.Guild.update(
					{
						ready: true,
						inactiveRoleId: setupConfig.inactiveRole?.id,
						inSessionRoleId: setupConfig.inSessionRole?.id,
					},
					{
						where: {
							guildId: guild.id,
						},
						transaction,
					},
				);

				await interaction.editReply({
					components: [endReplyMsg],
					allowedMentions: {
						roles: [],
						users: [],
					},
				});
			})
			.catch(async (e) => {
				await interaction.editReply({
					components: [
						new ContainerBuilder()
							.setAccentColor([255, 0, 0])
							.addTextDisplayComponents((text) =>
								text.setContent('## Setup failed\nAn error has occurred during this setup.'),
							),
					],
					flags: MessageFlags.IsComponentsV2,
				});
				if (!(e instanceof Errors.ExpectedError)) throw e;
				return;
			});
		Logging.quickInfo(interaction, 'Setup completed.');
	},
	limits: {
		usesPerInterval: 5,
		intervalMs: 60 * 60 * 1000,
		useCooldown: 0,
		scope: UsageScope.GuildMember,
	},
	description:
		'Includes configuration of logging, admin permissions (for both users and roles), and the inactive status role. Recommended to be run before using the rest of the commands, as most features require the server to be set up.',
});
