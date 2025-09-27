import { Events, GuildMember, InteractionReplyOptions, MessageFlags, userMention } from 'discord.js';
import { commands } from '../commands.js';
import { Data } from '../data.js';
import { CommandConstruct, CommandExecute, CommandOptionDictDeclare } from '../types/commandTypes.js';
import { ErrorReplies, Errors } from '../types/errors.js';
import { createEvent, GlobalCustomIds } from '../types/eventTypes.js';
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
			try {
				if (interaction.isAutocomplete()) {
					// Should exist, autocompletion
					await (cmd as CommandConstruct<true>).autocomplete?.(interaction).catch(Debug.error);
				} else {
					// Slash command
					const name = getCommandFullName(interaction);
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
			switch (interaction.customId) {
				case GlobalCustomIds.InSessionButton:
					const guild = interaction.guild;
					if (!guild) {
						Debug.error(`Interaction for ${GlobalCustomIds.InSessionButton} is not in a guild`);
						return;
					}
					const member = interaction.member as GuildMember | null;
					if (!member) {
						Debug.error(`Interaction for ${GlobalCustomIds.InSessionButton} has no member`);
						return;
					}
					const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
					if (!dbGuild) {
						Debug.error(`Interaction for ${GlobalCustomIds.InSessionButton} has no guild data`);
						return;
					}
					const session = await dbGuild.getSession();
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
					if (member.roles.cache.has(inSessionRole.id)) {
						await member.roles.remove(inSessionRole);
						await interaction.reply({
							content: '✅ Successfully left session',
							flags: MessageFlags.Ephemeral,
						});
						await Logging.log({
							data: interaction,
							formatData: `User ${userMention(member.id)} left the session`,
							logType: Logging.Type.Info,
							extents: [GuildFlag.LogInfo],
						});
					} else {
						await member.roles.add(inSessionRole);
						await interaction.reply({
							content: '✅ Successfully joined session',
							flags: MessageFlags.Ephemeral,
						});
						await Logging.log({
							data: interaction,
							formatData: `User ${userMention(member.id)} joined the session`,
							logType: Logging.Type.Info,
							extents: [GuildFlag.LogInfo],
						});
					}
			}
		}
	},
});
