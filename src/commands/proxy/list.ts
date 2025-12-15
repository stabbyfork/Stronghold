import { ChatInputCommandInteraction, ContainerBuilder } from 'discord.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { Pages } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const nProxies = await Data.models.ProxyCommand.count({ where: { guildId: guild.id } });
	if (nProxies === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoProxies]), true);
		return;
	}
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: nProxies,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			const commands = await Data.models.ProxyCommand.findAll({
				where: { guildId: guild.id },
				limit: perPage,
				offset: start,
			});
			return new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of proxy commands'),
				(text) =>
					text.setContent(
						commands.map((c) => `\`/${c.proxyCommand}\` -> \`/${c.targetCommand}\``).join('\n'),
					),
			);
		},
	});
	await pages.replyTo(interaction, false);
};
