import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { commandOptions } from '../../../cmdOptions.js';
import { defaultEmbed } from '../../../utils/discordUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../../utils/subcommandsUtils.js';
import { setRbxPoints } from './set.js';
import { Roblox } from '../../../utils/robloxUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';
import { ErrorReplies, Errors } from '../../../types/errors.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.rbx.points.add_d) => {
	if (!interaction.inGuild()) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) {
		return;
	}
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setDescription(
					'Fetching Roblox accounts linked to the provided Discord users...\n-# This may take a while, depending on the number of IDs provided.',
				)
				.setColor('Yellow')
				.setTitle('Processing'),
		],
	});

	const discordUsers = getOption(interaction, args, 'discord_ids')
		.matchAll(/\d+/g)
		.map((match) => match[0])
		.toArray();
	let robloxUsers = [];
	try {
		robloxUsers = await Roblox.discordToRobloxData(interaction.guildId, discordUsers);
	} catch (err) {
		await interaction.editReply({
			embeds: [
				defaultEmbed()
					.setColor('Red')
					.setTitle('Error during account linking')
					.setDescription(
						constructError(
							[ErrorReplies.FailedToFetchRobloxDataForDiscordIds],
							err instanceof Error ? err.message : String(err),
						),
					),
			],
			allowedMentions: { users: [], roles: [] },
		});
		return;
	}
	if (robloxUsers.length === 0) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.NoRobloxAccountsFoundForDiscordIds]), true);
		return;
	}
	const notFound = discordUsers.filter((id) => !robloxUsers.some((u) => u.discordId === id));
	if (notFound.length > 0) {
		await reportErrorToUser(
			interaction,
			`Some of the provided Discord IDs could not be linked to Roblox accounts: ${notFound.map((id) => `\`${id}\``).join(', ')}. \n-# Points were not modified.`,
			true,
		);
		return;
	}

	setRbxPoints(
		interaction,
		robloxUsers.map((u) => u.cachedUsername).join(' '),
		getOption(interaction, args, 'points'),
		(prevPoints, givenPoints) => prevPoints + givenPoints,
		(users, points) =>
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Added \`${points}\` point${points === 1 ? '' : 's'} to:\n${users.map((u) => `- \`${u.name}\``).join(',\n')}\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
				),
		(users, points) =>
			`Added \`${points}\` point${points === 1 ? '' : 's'} to:\n${users.map((u) => `\`${u.displayName}\` (\`${u.name}\`/\`${u.id}\`)`).join(',\n')}\n-# ${users.length} user${users.length === 1 ? '' : 's'}`,
	);
};
