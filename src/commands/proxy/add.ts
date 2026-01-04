import {
	APIApplicationCommandOption,
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	GuildMember,
	MessageFlags,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { commands } from '../../commands.js';
import { Data } from '../../data.js';
import { CommandConstruct, CommandData } from '../../types/commandTypes.js';
import { ErrorReplies } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';
import { ProxyUtils } from '../../utils/proxyUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import validator from 'validator';

function getOptions(data: CommandData): readonly APIApplicationCommandOption[] {
	// All SlashCommand* builders store options internally the same way
	// but they are not exposed in the public type
	return (data as unknown as { options?: APIApplicationCommandOption[] }).options ?? [];
}

/**
 * Resolves the final command options for a proxy to target path.
 */
export function resolveCommandOptionsFromTarget(
	commands: Record<string, CommandConstruct<boolean, any>>,
	target: string,
): readonly APIApplicationCommandOption[] | undefined {
	const parts = target.split(' ');
	const root = commands[parts[0]];
	if (!root) return undefined;

	let options = getOptions(root.data);

	for (let i = 1; i < parts.length; i++) {
		const name = parts[i];
		const next = options.find((o) => o.name === name);
		if (!next) return undefined;

		if (next instanceof SlashCommandSubcommandGroupBuilder || next instanceof SlashCommandSubcommandBuilder) {
			options = (next.options as APIApplicationCommandOption[]) ?? [];
			continue;
		}

		return undefined;
	}

	return options;
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.proxy.add) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManageProxies))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManageProxies),
			true,
		);
		return;
	}
	if ((await Data.models.ProxyCommand.count({ where: { guildId: guild.id } })) >= 50) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyLimit]), true);
		return;
	}

	const proxy = getOption(interaction, args, 'proxy');
	const target = getOption(interaction, args, 'target');

	if (proxy.length > 32) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyNameTooLong]), true);
		return;
	}
	if (target.length > 32) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyTargetTooLong]), true);
		return;
	}
	if (validator.contains(proxy, '')) {
		await reportErrorToUser(interaction, `The proxy cannot contain spaces.`, true);
		return;
	}
	if (proxy.match(/[A-Z]+/)) {
		await reportErrorToUser(interaction, `The proxy cannot contain uppercase letters.`, true);
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const opts = resolveCommandOptionsFromTarget(commands, target);
	if (!opts) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InvalidProxyTarget], target), true);
		return;
	}
	// DO NOT return non-subcommands
	if (
		opts.some((o) => o instanceof SlashCommandSubcommandBuilder || o instanceof SlashCommandSubcommandGroupBuilder)
	) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyTargetNotSubcommand]), true);
		return;
	}
	// Assume single-word proxy
	if (proxy in commands) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.ProxyNameExists], proxy), true);
		return;
	}

	const cmd = new SlashCommandBuilder().setName(proxy).setDescription(`Runs /${target}`).toJSON();
	// @ts-expect-error They are compatible
	cmd.options = opts;
	const existing = await ProxyUtils.get(guild.id);
	await Data.mainDb.transaction(async (transaction) => {
		await Data.models.ProxyCommand.create(
			{ guildId: guild.id, proxyCommand: proxy, targetCommand: target },
			{
				transaction,
			},
		);
		await ProxyUtils.set(guild.id, ...existing, cmd);
	});
	await interaction.editReply({
		embeds: [
			defaultEmbed()
				.setTitle('Added proxy command')
				.setColor('Green')
				.setDescription(`Added \`/${proxy}\` as a proxy for \`/${target}\`.`),
		],
	});
	Logging.quickInfo(interaction, `Added proxy command \`/${proxy}\` for \`/${target}\``);
};
