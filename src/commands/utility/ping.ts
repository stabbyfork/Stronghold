import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../../types/commandTypes.js';
import { ErrorReplies } from '../../types/errors.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';

export default createCommand({
	data: new SlashCommandBuilder().setName('ping').setDescription("Replies with 'Pong!' and latency details"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		{
			const resp = await interaction.reply({ content: 'Pinging...', withResponse: true });
			const createdT = resp.resource?.message?.createdTimestamp;
			if (!createdT) {
				throw new Error('Failed to get created timestamp');
			}
			const intrPing = createdT - interaction.createdTimestamp;
			await interaction.editReply(`Pong! Total ping: ${intrPing}ms`);
		}
	},
});
