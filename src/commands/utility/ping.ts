import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { client } from '../../client.js';
import { createCommand, ErrorReplies } from '../../types.js';
import { constructError, reportErrorToUser } from '../../utils.js';

export default createCommand({
	data: new SlashCommandBuilder().setName('ping').setDescription("Replies with 'Pong!' and latency details"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		{
			const resp = await interaction.reply({ content: 'Pinging...', withResponse: true });
			const createdT = resp.resource?.message?.createdTimestamp;
			if (!createdT) {
				await reportErrorToUser(
					interaction,
					constructError([ErrorReplies.UnknownError, ErrorReplies.ReportToOwner]),
				);
				return;
			}
			const intrPing = createdT - interaction.createdTimestamp;
			await interaction.editReply(`Pong! Total ping: ${intrPing}ms`);
		}
	},
});
