import {
	APIApplicationCommand,
	APIApplicationCommandOption,
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	ContainerBuilder,
	MessageFlags,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
	TextDisplayBuilder,
} from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { commands, subcommands } from '../../commands.js';
import { createCommand } from '../../types/commandTypes.js';
import { ErrorReplies } from '../../types/errors.js';
import { Pages } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { flattenVals, getValue } from '../../utils/genericsUtils.js';
import { getOption, getSubcommands } from '../../utils/subcommandsUtils.js';
const commandArray: string[] = [];
let splitHelpText: string[] = [];

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Replies with a list of all commands or details of a specific command')
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to get help for')
				.setRequired(false)
				.setAutocomplete(true),
		),
	once: async () => {
		for (const command of Object.values(commands)) {
			const subs = getSubcommands(command.data as SlashCommandBuilder, ' ');
			if (typeof subs !== 'string') {
				commandArray.push(...(flattenVals(subs) as string[]));
			} else {
				commandArray.push(subs);
			}
		}
		for (let i = 0; i < commandArray.length; i++) {
			const command = commandArray[i];
			const parts = command.split(' ');
			for (let j = 0; j < parts.length; j++) {
				const part = parts[j];
				const joined = parts.slice(0, j + 1).join(' ');
				if (!commandArray.includes(joined)) {
					commandArray.splice(i + j, 0, joined);
				}
			}
		}
		let currentCmd = [] as string[];
		let outStr = '';
		let lastDescendant = false;
		let finalBranch = false;
		for (let cmdI = 0; cmdI < commandArray.length; cmdI++) {
			const cmd = commandArray[cmdI];
			const nextCmd = commandArray[cmdI + 1];
			const cmdParts = cmd.split(' ');
			if (nextCmd?.split(' ')[cmdParts.length - 2] !== cmdParts[cmdParts.length - 2]) {
				lastDescendant = true;
			} else {
				lastDescendant = false;
			}
			for (let i: number = 0; i < commandArray.length - cmdI; i++) {
				const previewCmd = commandArray[cmdI + i]?.split(' ');
				if (!previewCmd) break;
				if (previewCmd[0] !== cmdParts[0]) {
					finalBranch = true;
					break;
				} else {
					if (previewCmd[1] !== cmdParts[1]) {
						finalBranch = false;
						break;
					}
				}
			}
			for (let i: number = 0; i < cmdParts.length; i++) {
				if (currentCmd[i] === undefined || cmdParts[i] !== currentCmd[i]) {
					const cmdName = cmdParts[i];
					let cmdOut = cmdName;
					switch (i) {
						case 0:
							// Bold blue
							cmdOut = `[1;36m[2;34m/${cmdName}[0m[0m`;
							break;
						case 1:
							if (
								typeof subcommands[cmdParts[0] as keyof typeof subcommands]?.[
									cmdParts[1] as keyof (typeof subcommands)[keyof typeof subcommands]
								] !== 'object'
							) {
								// Gold (no subcommands)
								cmdOut = `[2;33m${cmdName}[0m`;
								break;
							}
							// Purple
							cmdOut = `[2;35m${cmdName}[0m`;
							break;
						case 2:
							// Gold
							cmdOut = `[2;33m${cmdName}[0m`;
							break;
					}
					/*switch (cmdName) {
							case 'add':
							case 'create':
							case 'start':
							case 'set':
							case 'quickstart':
							case 'resume':
								// Green
								cmdOut = `[2;32m${cmdName}[0m`;
								break;
							case 'clear':
							case 'cancel':
							case 'stop':
							case 'remove':
								// Red
								cmdOut = `[2;31m${cmdName}[0m`;
								break;
							case 'lb':
							case 'info':
							case 'list':
							case 'get':
							case 'view':
							case 'status':
								// Teal
								cmdOut = `[2;36m${cmdName}[0m`;
								break;
						}*/
					outStr += `${i > 0 ? `${(!finalBranch ? '│  ' : '   ').repeat(i - 1)}${lastDescendant || (finalBranch && i === 1) ? '└─ ' : '├─ '}` : ''}${cmdOut}\n`;
				}
			}
			currentCmd = cmdParts;
		}
		splitHelpText = outStr.split('\n');
	},
	execute: async (interaction, args: typeof commandOptions.help) => {
		const msg = new ContainerBuilder();
		const cmd = getOption(interaction, args, 'command');
		// Info for one command
		if (cmd) {
			const cmdParts = cmd.split(' ');
			const mainCommand = commands[cmdParts[0] as keyof typeof commands];
			if (!mainCommand) {
				await reportErrorToUser(
					interaction,
					constructError([ErrorReplies.CommandNotFoundSubstitute], cmd ?? '(empty)'),
					true,
				);
				return;
			}
			let subcommand;
			if (mainCommand.data.name in subcommands) {
				if (cmdParts[1]) {
					const sub1 = mainCommand.data.toJSON().options?.find((o) => o.name === cmdParts[1]);
					if (!sub1) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.CommandNotFoundSubstitute], cmd ?? '(empty)'),
							true,
						);
						return;
					}
					subcommand = sub1;
				}
				if (cmdParts[2]) {
					const sub2 = (subcommand as unknown as APIApplicationCommand)?.options?.find(
						(o) => o.name === cmdParts[2],
					);
					if (!sub2) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.CommandNotFoundSubstitute], cmd ?? '(empty)'),
							true,
						);
						return;
					}
					subcommand = sub2;
				}
			}
			subcommand ??= mainCommand.data;
			let cmdLongDesc: string | undefined = '';
			/*if (typeof mainCommand.description === 'string') {
				cmdLongDesc = mainCommand.description;
			} else if (cmdParts.length === 2) {
				cmdLongDesc = mainCommand.description?.[cmdParts[1] as keyof typeof mainCommand.description] as
					| string
					| undefined;
			} else if (cmdParts.length === 3) {
				// @ts-expect-error If it works, it works..
				cmdLongDesc = (
					mainCommand.description?.[cmdParts[1] as keyof typeof mainCommand.description] as Exclude<
						typeof mainCommand.description,
						string
					>
				)?.[cmdParts[2] as any] as string | undefined;
			}*/
			if (typeof mainCommand.description === 'string') {
				cmdLongDesc = mainCommand.description;
			} else {
				const newDesc = getValue(mainCommand.description, cmdParts.slice(1));
				if (typeof newDesc === 'string') {
					cmdLongDesc = newDesc;
				}
			}
			const hasSubcommands = (subcommand as any).options.some(
				(o: APIApplicationCommandOption) =>
					o instanceof SlashCommandSubcommandBuilder ||
					o instanceof SlashCommandSubcommandGroupBuilder ||
					o.type === ApplicationCommandOptionType.SubcommandGroup ||
					o.type === ApplicationCommandOptionType.Subcommand,
			);
			msg.addTextDisplayComponents(
				(text) => text.setContent(`## Help for /${cmd}`),
				(text) => text.setContent(`### Description\n${subcommand.description}`),
				(text) =>
					text.setContent(
						`### ${hasSubcommands ? 'Subcommands' : 'Options'}\n${subcommand?.options
							?.map((o: APIApplicationCommandOption) => `- \`${o.name}\`: ${o.description}`)
							.join('\n')}`,
					),
			);
			if (cmdLongDesc) {
				msg.spliceComponents(2, 0, new TextDisplayBuilder({ content: cmdLongDesc }));
			}

			await interaction.reply({ components: [msg], flags: [MessageFlags.IsComponentsV2] });
		} else {
			// All commands
			const pages = new Pages({
				itemsPerPage: 20,
				totalItems: splitHelpText.length - 1,
				createPage: async (index, perPage) => {
					const start = index * perPage;
					return new ContainerBuilder().addTextDisplayComponents(
						(text) => text.setContent('## List of commands'),
						(text) =>
							text.setContent(
								'```ansi\n' + splitHelpText.slice(start, start + perPage).join('\n') + '\n```',
							),
					);
				},
			});
			await pages.replyTo(interaction, false);
		}
	},
	autocomplete: async (interaction: AutocompleteInteraction) => {
		const focusedValue = interaction.options.getFocused();
		const command = focusedValue.trim();
		if (command === '') {
			await interaction.respond(
				commandArray.slice(0, Math.min(25, commandArray.length)).map((x) => ({ name: x, value: x })),
			);
			return;
		}
		const startsWithLast = commandArray.filter((x) => x.startsWith(command));
		await interaction.respond(
			startsWithLast.slice(0, Math.min(25, startsWithLast.length)).map((x) => ({ name: x, value: x })),
		);
	},
	description:
		'The Discord command description character limit is 100 characters, so some commands may have longer descriptions on their help entry.',
});
