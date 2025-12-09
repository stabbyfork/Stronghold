import {
	AutocompleteInteraction,
	Events,
	GuildMember,
	Interaction,
	InteractionReplyOptions,
	MessageFlags,
	userMention,
} from 'discord.js';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { CommandConstruct, CommandExecute, CommandOptionDictDeclare } from '../types/commandTypes.js';
import { ErrorReplies, Errors } from '../types/errors.js';
import { createEvent, GlobalCustomIds, InformedCustomId } from '../types/eventTypes.js';
import { constructError, Debug, reportErrorToUser } from '../utils/errorsUtils.js';
import { getValue } from '../utils/genericsUtils.js';
import { GuildFlag } from '../utils/guildFlagsUtils.js';
import { Logging } from '../utils/loggingUtils.js';
import { getAllOptionsOfCommand, getCommandFullName, getSubcommandExec } from '../utils/subcommandsUtils.js';
import {
	UsageDefaults,
	UsageEnum,
	UsageLimit,
	UsageLimitParams,
	Usages,
	UsageScope,
} from '../utils/usageLimitsUtils.js';
import { GuildAssociations } from '../models/guild.js';
import { DPM } from '../utils/diplomacyUtils.js';
import { GuildRelation } from '../models/relatedGuild.js';
import { Op } from '@sequelize/core';
import { client } from '../client.js';
import { SessionParticipantAssociations } from '../models/sessionParticipant.js';
import ms from 'ms';
import { messageCompCollector } from '../utils/discordUtils.js';

export default createEvent({
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction) {
		if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
			const cmd = commands?.[interaction.commandName as keyof typeof commands] as
				| CommandConstruct<boolean, CommandOptionDictDeclare>
				| undefined;
			if (!cmd) {
				console.error(`Command \`${interaction.commandName}\` not found`);
				if (interaction.isChatInputCommand()) {
					reportErrorToUser(
						interaction,
						constructError([ErrorReplies.CommandNotFound, ErrorReplies.OutdatedCommand]),
					);
				}
				return;
			}
			let cmdLim: UsageLimit | undefined;
			const name = getCommandFullName(interaction);
			try {
				if (interaction.isAutocomplete()) {
					// Should exist, autocompletion
					const autoCmd = cmd as CommandConstruct<true>;
					if (typeof autoCmd.autocomplete === 'function') {
						if (autoCmd.autocomplete) {
							await autoCmd.autocomplete(interaction).catch(Debug.error);
						} else {
							Debug.error(`Autocomplete function not found for command: ${name.join(' ')}`);
						}
					} else {
						const autoComp = name
							.slice(1)
							.reduce((acc, cur) => acc?.[cur as keyof typeof acc], autoCmd.autocomplete) as
							| undefined
							| ((interaction: AutocompleteInteraction) => Promise<void>);
						if (autoComp) {
							await autoComp(interaction).catch(Debug.error);
						} else {
							Debug.error(`Autocomplete function not found for command: ${name.join(' ')}`);
						}
					}
				} else {
					// Slash command
					const joinedName = name.join(' ');
					const [ready, limit] = Usages.isReadyMany([UsageEnum.CommandExecute, joinedName], interaction);
					if (!ready) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.CooldownSubstitute], limit.timeUntilNextUse()),
						);
						return;
					}
					const limits = cmd.limits;
					const mainMap = Usages.byScope(interaction);
					const execLim = mainMap.getSetClone(UsageEnum.CommandExecute, UsageDefaults[UsageEnum.DMSend]);
					if (!execLim.use()) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.CooldownSubstitute], execLim.timeUntilNextUse()),
						);
						return;
					}
					// Workaround
					if (limits instanceof UsageLimit) {
						const mainLim = Usages.byScope(limits.scope ?? UsageScope.GuildMember, interaction).getSetClone(
							joinedName,
							limits,
						);
						cmdLim = mainLim;
						if (!mainLim.use()) {
							await reportErrorToUser(
								interaction,
								constructError([ErrorReplies.CooldownSubstitute], mainLim.timeUntilNextUse()),
							);
							return;
						}
					} else if (limits) {
						const unclonedLimParams = getValue(limits, name.slice(1)) as UsageLimitParams | undefined;
						if (unclonedLimParams) {
							const unclonedLim = new UsageLimit(unclonedLimParams);
							const mainLim = Usages.byScope(unclonedLim.scope, interaction).getSetClone(
								joinedName,
								unclonedLim,
							);
							cmdLim = mainLim;
							if (!mainLim.use()) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.CooldownSubstitute], mainLim.timeUntilNextUse()),
								);
								return;
							}
						}
					}

					const [cmdExec, _, hasSubcommands] = getSubcommandExec(interaction);
					const opts = getAllOptionsOfCommand(interaction) ?? {};
					if (hasSubcommands) {
						// Also run the main command function, even if there are subcommands
						await (cmd.execute as CommandExecute<CommandOptionDictDeclare> | undefined)?.(
							interaction,
							opts,
						).catch((err) => {
							if (err instanceof Error) {
								throw err;
							}
							throw new Errors.MainCommandError(err);
						});
					}
					await (cmdExec as unknown as CommandExecute<CommandOptionDictDeclare>)(interaction, opts).catch(
						(err) => {
							if (err instanceof Error) {
								throw err;
							}
							throw hasSubcommands ? new Errors.SubcommandError(err) : new Errors.CommandError(err);
						},
					);
				}
			} catch (err) {
				if (err instanceof Errors.TransactionError) {
					await err.data.rollback();
				}
				const fullName = getCommandFullName(interaction).join(' ');
				if (interaction.isChatInputCommand() && (typeof err === 'string' || err instanceof Error)) {
					if (err instanceof Error) {
						Debug.error(`Error while executing command \`${fullName}\`: ${err.stack}`);
					}
					const toReply: InteractionReplyOptions = {
						content: constructError(
							[ErrorReplies.UnknownError, ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
							err.toString(),
						),
						flags: MessageFlags.Ephemeral,
					};
					reportErrorToUser(interaction, toReply);
					// Allow retries
					cmdLim?.addUse(true);
					Logging.log({
						data: interaction,
						formatData: {
							msg: `Unexpected non-fatal error encountered`,
							action: `Execution of command \`${fullName}\``,
							userId: interaction.user.id,
							cause: `\`${err.toString()}\``,
						},
						extents: [GuildFlag.LogErrors],
						logType: Logging.Type.Error,
					});
				} else {
					console.error(`Error while executing command \`${fullName}\`: ${err}`);
				}
			}
		} else if (interaction.isMessageComponent()) {
			let handled = false;
			switch (interaction.customId) {
				case GlobalCustomIds.InSessionJoin:
					{
						const guild = interaction.guild;
						if (!guild) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} is not in a guild`);
							return;
						}
						const member = interaction.member as GuildMember | null;
						if (!member) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} has no member`);
							return;
						}
						const dbGuild = await Data.models.Guild.findOne({
							where: { guildId: guild.id },
							include: [GuildAssociations.Session],
						});
						if (!dbGuild) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} has no guild data`);
							return;
						}
						const session = dbGuild?.session;
						if (!session || !session.active) {
							await interaction.reply({
								content: '❌ No session is currently active',
								flags: MessageFlags.Ephemeral,
							});
							return;
						}
						const inSessionRole = dbGuild.inSessionRoleId
							? (guild.roles.cache.get(dbGuild.inSessionRoleId) ??
								(await guild.roles.fetch(dbGuild.inSessionRoleId)))
							: null;
						if (!inSessionRole) {
							await interaction.reply({
								content: '❌ No in-session role found',
								flags: MessageFlags.Ephemeral,
							});
							await Logging.log({
								data: interaction,
								formatData: {
									msg: 'No in-session role found of id: ' + dbGuild.inSessionRoleId,
									action: "Interaction for session 'Join' button",
									userId: member.id,
									cause: 'Could not get or fetch in-session role',
								},
								logType: Logging.Type.Warning,
								extents: [GuildFlag.LogWarnings],
							});
							return;
						}
						/*if (member.roles.cache.has(inSessionRole.id)) {
							await interaction.reply({
								content: '❌ You are already in the session',
								flags: MessageFlags.Ephemeral,
							});
							return;
						}*/
						const participant = await Data.models.SessionParticipant.findOne({
							where: { sessionId: session.id },
							include: [
								{
									model: Data.models.User,
									as: SessionParticipantAssociations.User,
									where: { userId: member.id },
								},
							],
						});
						if (participant?.inSession) {
							await interaction.reply({
								content: '❌ You are already in the session',
								flags: MessageFlags.Ephemeral,
							});
							return;
						}
						try {
							await Data.mainDb.transaction(async (transaction) => {
								await member.roles.add(inSessionRole, 'Joined session');
								if (participant) {
									await participant.update(
										{ inSession: true, joinedAt: new Date() },
										{ transaction },
									);
									await session.addParticipant(participant, { transaction });
								} else {
									const [usr] = await Data.models.User.findOrCreate({
										where: { userId: member.id, guildId: guild.id },
										defaults: {
											userId: member.id,
											guildId: guild.id,
										},
										transaction,
									});
									await session.createParticipant(
										{
											userId: usr.id,
											inSession: true,
											joinedAt: new Date(),
										},
										{
											transaction,
										},
									);
								}
								await interaction.reply({
									content: '✅ Successfully joined session',
									flags: MessageFlags.Ephemeral,
								});
							});
						} catch (e) {
							Debug.error(e);
							await interaction.reply({
								content: '❌ Failed to join session',
								flags: MessageFlags.Ephemeral,
							});
							if (e instanceof Error || typeof e === 'string') {
								await Logging.log({
									data: interaction,
									formatData: {
										msg: 'Failed to join session: ' + e.toString(),
										action: "Interaction for session 'Join' button",
										userId: member.id,
										cause: 'Transaction threw error',
									},
									logType: Logging.Type.Error,
									extents: [GuildFlag.LogErrors],
								});
							}
							break;
						}
						await Logging.log({
							data: interaction,
							formatData: `${userMention(member.id)} joined the session`,
							logType: Logging.Type.Info,
							extents: [GuildFlag.LogInfo],
						});
					}
					handled = true;
					break;
				case GlobalCustomIds.InSessionLeave:
					{
						const guild = interaction.guild;
						if (!guild) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} is not in a guild`);
							return;
						}
						const member = interaction.member as GuildMember | null;
						if (!member) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} has no member`);
							return;
						}
						const dbGuild = await Data.models.Guild.findOne({
							where: { guildId: guild.id },
							include: [GuildAssociations.Session],
						});
						if (!dbGuild) {
							Debug.error(`Interaction for ${GlobalCustomIds.InSessionJoin} has no guild data`);
							return;
						}
						const session = dbGuild?.session;
						if (!session || !session.active) {
							await interaction.reply({
								content: '❌ No session is currently active',
								flags: MessageFlags.Ephemeral,
							});
							return;
						}
						const inSessionRole = dbGuild.inSessionRoleId
							? (guild.roles.cache.get(dbGuild.inSessionRoleId) ??
								(await guild.roles.fetch(dbGuild.inSessionRoleId)))
							: null;
						if (!inSessionRole) {
							await interaction.reply({
								content: '❌ No in-session role found',
								flags: MessageFlags.Ephemeral,
							});
							await Logging.log({
								data: interaction,
								formatData: {
									msg: 'No in-session role found of id: ' + dbGuild.inSessionRoleId,
									action: "Interaction for session 'Join' button",
									userId: member.id,
									cause: 'Could not get or fetch in-session role',
								},
								logType: Logging.Type.Warning,
								extents: [GuildFlag.LogWarnings],
							});
							return;
						}
						const participant = await Data.models.SessionParticipant.findOne({
							where: { sessionId: session.id },
							include: [
								{
									model: Data.models.User,
									as: SessionParticipantAssociations.User,
									where: { userId: member.id },
								},
							],
						});
						//member.roles.cache.has(inSessionRole.id)
						if (participant?.inSession) {
							await Data.mainDb.transaction(async (transaction) => {
								await member.roles.remove(inSessionRole, 'Left session');
								if (!participant.joinedAt) {
									await reportErrorToUser(
										interaction,
										constructError(
											[ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner],
											'Participant joinedAt is null',
										),
										true,
									);
									return;
								}
								await participant.update(
									{
										inSession: false,
										timeSpent:
											participant.timeSpent + (Date.now() - participant.joinedAt.getTime()),
									},
									{ transaction },
								);
								await interaction.reply({
									content: '✅ Successfully left session',
									flags: MessageFlags.Ephemeral,
								});
								await Logging.log({
									data: interaction,
									formatData: `${userMention(member.id)} left the session and has spent a total of ${ms(
										participant.timeSpent,
										{
											long: true,
										},
									)}`,
									logType: Logging.Type.Info,
									extents: [GuildFlag.LogInfo],
								});
							});
						} else {
							await interaction.reply({
								content: '❌ You are not in the session',
								flags: MessageFlags.Ephemeral,
							});
						}
					}
					handled = true;
					break;
			}
			if (handled) return;
			// Parse custom IDs with data attached
			if (InformedCustomId.isValid(interaction.customId)) {
				const { name, data } = InformedCustomId.deformat(interaction.customId);
				const sourceGuild = interaction.guild;
				switch (name) {
					case DPM.CustomId.AcceptAlly: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.AcceptAlly} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.AcceptAlly} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							// Swap around the guilds to find where the request is coming from
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: targetGuildId,
									targetGuildId: sourceGuild.id,
								},
								attributes: ['activeChange', 'relation'],
							});
							if (dbRel?.activeChange !== GuildRelation.Ally) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoAllianceRequest]),
									true,
								);
								return;
							}
							if (dbRel.relation === GuildRelation.Ally) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.AlreadyAllied]),
									true,
								);
								return;
							}
							// Swap around the guilds to find where the request is coming from
							await DPM.transaction(
								{ source: targetGuildId, target: sourceGuild },
								DPM.TransactionType.AllyAccept,
								{
									author: interaction.user,
									message: 'No message can be provided.',
								},
							);
							/*await Data.mainDb.transaction(async (transaction) => {
								await Data.models.RelatedGuild.update(
									{ relation: GuildRelation.Ally },
									{
										where: {
											[Op.or]: [
												{ guildId: sourceGuild.id, targetGuildId: targetGuildId },
												{ guildId: targetGuildId, targetGuildId: sourceGuild.id },
											],
										},
										transaction,
									},
								);
							});*/
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully accepted ally request from ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}`,
							});
						}
						break;
					}
					case DPM.CustomId.DeclineAlly: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							// Swap around to find where the request is coming from
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: targetGuildId,
									targetGuildId: sourceGuild.id,
								},
								attributes: ['activeChange'],
							});
							if (dbRel?.activeChange !== GuildRelation.Ally) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoAllianceRequest]),
									true,
								);
								return;
							}
							await dbRel.update({ activeChange: null });
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully declined ally request from ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}`,
							});
						}
						break;
					}
					case DPM.CustomId.CancelAlly: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: sourceGuild.id,
									targetGuildId,
								},
								attributes: ['activeChange'],
							});
							if (dbRel?.activeChange !== GuildRelation.Ally) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoAllianceRequest]),
									true,
								);
								return;
							}
							await DPM.transaction(
								{
									source: sourceGuild,
									target: targetGuildId,
								},
								DPM.TransactionType.AllyCancel,
								{
									author: interaction.user,
									message: 'No message can be provided.',
								},
							);
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully cancelled ally request to ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}`,
							});
						}
						break;
					}
					case DPM.CustomId.AcceptNeutral: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.AcceptNeutral} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.AcceptNeutral} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							// Swap around to find where the request is coming from
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: targetGuildId,
									targetGuildId: sourceGuild.id,
								},
								attributes: ['activeChange', 'relation'],
							});
							if (dbRel?.activeChange !== GuildRelation.Neutral) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoNeutralRequest]),
									true,
								);
								return;
							}
							if (dbRel?.relation === GuildRelation.Neutral) {
								await reportErrorToUser(interaction, constructError([ErrorReplies.AlreadyNeutral]));
								return;
							}
							await DPM.transaction(
								{
									// Swap them around since targetGuildId is the initiator and sourceGuild is the target
									source: targetGuildId,
									target: sourceGuild,
								},
								DPM.TransactionType.NeutralAccept,
								{
									author: interaction.user,
									message: 'No message can be provided.',
								},
							);
							/*await Data.mainDb.transaction(async (transaction) => {
								await Data.models.RelatedGuild.update(
									{ relation: GuildRelation.Neutral },
									{
										where: {
											[Op.or]: [
												{ guildId: sourceGuild.id, targetGuildId: targetGuildId },
												{ guildId: targetGuildId, targetGuildId: sourceGuild.id },
											],
										},
										transaction,
									},
								);
							});*/
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully accepted peace request from ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}.`,
							});
						}
					}
					case DPM.CustomId.DeclineNeutral: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineNeutral} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineNeutral} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							// Swap around to find where the request is coming from
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: targetGuildId,
									targetGuildId: sourceGuild.id,
								},
								attributes: ['activeChange'],
							});
							if (dbRel?.activeChange !== GuildRelation.Neutral) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoNeutralRequest]),
									true,
								);
								return;
							}
							await dbRel.update({ activeChange: null });
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully declined peace request from ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}`,
							});
						}
					}
					case DPM.CustomId.CancelNeutral: {
						{
							const targetGuildId = data[0];
							if (!targetGuildId) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} has no target guild`);
								await reportErrorToUser(
									interaction,
									constructError([
										ErrorReplies.InteractionHasNoTargetGuild,
										ErrorReplies.ReportToOwner,
									]),
									true,
								);
								return;
							}
							if (!sourceGuild) {
								Debug.error(`Interaction for ${DPM.CustomId.DeclineAlly} is not in a guild`);
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.InteractionHasNoGuild, ErrorReplies.ReportToOwner]),
									true,
								);
								return;
							}
							const dbRel = await Data.models.RelatedGuild.findOne({
								where: {
									guildId: sourceGuild.id,
									targetGuildId,
								},
								attributes: ['activeChange'],
							});
							if (dbRel?.activeChange !== GuildRelation.Neutral) {
								await reportErrorToUser(
									interaction,
									constructError([ErrorReplies.NoNeutralRequest]),
									true,
								);
								return;
							}
							await DPM.transaction(
								{
									source: sourceGuild,
									target: targetGuildId,
								},
								DPM.TransactionType.NeutralCancel,
								{
									author: interaction.user,
									message: 'No message can be provided.',
								},
							);
							try {
								await interaction.message.edit({
									components: [],
									embeds: interaction.message.embeds,
								});
							} catch (e) {
								Debug.error(e);
							}
							await interaction.reply({
								content: `✅ Successfully cancelled peace request from ${client.guilds.cache.get(targetGuildId)?.name ?? 'an unknown guild'}`,
							});
						}
						break;
					}
				}
			}
		}
	},
});
