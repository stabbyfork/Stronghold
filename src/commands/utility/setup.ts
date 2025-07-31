import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Interaction,
	PermissionsBitField,
	SlashCommandBuilder,
} from 'discord.js';
import { createCommand, ErrorReplies } from '../../types.js';
import { constructError, defaultEmbed, isSameUser, reportErrorToUser, waitForMessageComp } from '../../utils.js';
import { Data } from '../../data.js';
import { Permission, PermissionBits } from '../../schema.js';

export default createCommand({
	data: new SlashCommandBuilder().setName('setup').setDescription('Set up the bot for the first time'),
	execute: async (interaction) => {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
			reportErrorToUser(interaction, constructError([ErrorReplies.PermissionError]));
			return;
		}
		const confButton = new ButtonBuilder()
			.setCustomId('setup')
			.setLabel('Start setup')
			.setStyle(ButtonStyle.Primary);

		const row = new ActionRowBuilder().addComponents(confButton);
		const resp = await interaction.reply({
			embeds: [
				defaultEmbed()
					.setTitle('Setup')
					.setDescription(
						'This will set up the bot for this server. You (the person who has run the command) will be made an admin,\
						however, any other user who has Administrator permissions will be able to add themselves as an admin. \
						Only the server owner can remove administrators.',
					)
					.setThumbnail(interaction.guild?.iconURL() ?? null)
					.setAuthor({
						name: interaction.user.username,
						iconURL: interaction.user.avatarURL() ?? undefined,
					}),
			],
			components: [row as any],
			withResponse: true,
		});
		const filter = (i: Interaction) => isSameUser(i, interaction);
		const confirm = await waitForMessageComp(resp, filter, 5);
		if (!confirm) return;

		await confirm.deferUpdate();
		const guildId = interaction.guildId;
		if (!guildId) {
			reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]));
			return;
		}

		if (
			await Data.remoteModels.Guild.findOne({
				where: { guildId, ready: true },
			})
		) {
			reportErrorToUser(interaction, constructError([ErrorReplies.SetupAlreadyComplete]));
			return;
		}
		const currPerms =
			(
				await Data.remoteModels.UserPermissions.findOne({
					where: { guildId, userId: interaction.user.id },
				})
			)?.permissions ?? 0;

		Data.remoteModels.UserPermissions.upsert({
			guildId,
			userId: interaction.user.id,
			permissions: PermissionBits[Permission.Administrator] | currPerms,
		});
		Data.remoteModels.Guild.upsert({
			guildId: guildId,
			ready: true,
		});
		interaction.followUp('Setup complete!');
	},
});
