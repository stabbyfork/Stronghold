import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ForumChannel,
	MessageActionRowComponentBuilder,
} from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies } from '../../types/errors.js';
import { DPM, isDiploReady } from '../../utils/diplomacyUtils.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { Logging } from '../../utils/loggingUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';

const enum CustomIds {
	Confirm = 'confirm',
}

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.setup) => {
	if (!(await reportErrorIfNotSetup(interaction))) return;
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (interaction.user.id !== guild.ownerId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.MustBeServerOwner]), true);
		return;
	}
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
	if (!dbGuild) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'Guild not found in database'),
			true,
		);
		return;
	}
	let channel = getOption(interaction, args, 'diplomacy_channel') as ForumChannel | null;

	const newTag = getOption(interaction, args, 'tag').toLowerCase();
	const existingGuild = await Data.models.Guild.findOne({ where: { tag: newTag } });
	if (existingGuild && existingGuild.guildId !== guild.id) {
		await reportErrorToUser(interaction, 'This tag is already in use. Please choose another one.', true);
		return;
	}
	const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder().setCustomId(CustomIds.Confirm).setLabel('Confirm').setStyle(ButtonStyle.Success),
	);
	const resp = await interaction.reply({
		embeds: [
			defaultEmbed()
				.setTitle('Confirmation')
				.setDescription(
					`Are you sure you want to use the tag \`${newTag}\`?\n${channel ? `The diplomacy channel will be set to ${channel}.` : 'A new channel for diplomacy will be created.'}${(await isDiploReady(guild)) ? '\nConfirming will reset diplomacy data set in the previous setup.' : ''}\n\n-# Do not click the button to deny.`,
				)
				.setColor('Yellow'),
		],
		components: [row],
		withResponse: true,
	});
	try {
		const comp = await resp.resource?.message?.awaitMessageComponent({
			time: 30000,
			filter: (i) => i.customId === CustomIds.Confirm && i.user.id === interaction.user.id,
		});
		comp?.deferUpdate();
	} catch {
		await interaction.editReply({
			embeds: [defaultEmbed().setTitle('Confirmation').setDescription('Confirmation timed out.').setColor('Red')],
		});
		return;
	}
	if (channel) {
		dbGuild.dpmChannelId = channel.id;
	} else {
		channel = await DPM.createChannel(guild);
		dbGuild.dpmChannelId = channel.id;
	}
	dbGuild.tag = newTag;
	dbGuild.ready = true;
	await dbGuild.save();
	await interaction.followUp({
		embeds: [
			defaultEmbed()
				.setTitle('Diplomacy set up successfully')
				.setDescription(`Most diplomacy commands are now available. Set tag to \`${newTag}\`.`)
				.setColor('Green'),
		],
	});
	Logging.quickInfo(interaction, `Diplomacy set up successfully. Set tag to \`${newTag}\`.`);
};
