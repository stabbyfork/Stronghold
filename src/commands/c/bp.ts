import { ChatInputCommandInteraction, GuildMember, MessageFlags, userMention } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { Data } from '../../data.js';
import { ErrorReplies, Errors } from '../../types/errors.js';
import { defaultEmbed } from '../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../utils/errorsUtils.js';
import { Roblox } from '../../utils/robloxUtils.js';
import { getOption, reportErrorIfNotSetup } from '../../utils/subcommandsUtils.js';
import { setRbxPoints } from '../rbx/points/set.js';
import { Logging } from '../../utils/loggingUtils.js';
import { hasPermissions, Permission } from '../../utils/permissionsUtils.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.c.bp) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await reportErrorIfNotSetup(interaction))) return;

	if (!(await hasPermissions(interaction.member as GuildMember, guild, true, Permission.ManagePoints))) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.PermissionsNeededSubstitute], Permission.ManagePoints),
			true,
		);
	}

	const rbxName = getOption(interaction, args, 'rbx_name');
	// Set to default of 1 if not provided
	const points = getOption(interaction, args, 'points') ?? 1;

	const userData = await Roblox.usernameToData(rbxName);
	if (!userData) {
		await reportErrorToUser(interaction, `Could not find Roblox user \`${rbxName}\`.`, true);
		return;
	}
	const avatar = await Roblox.idToAvatarBust(userData.id);

	const session = await Data.models.GuildSession.findOne({ where: { guildId: guild.id } });
	if (!session?.active) {
		await reportErrorToUser(interaction, ErrorReplies.NoExistingSession, true);
		return;
	}
	const [rbxUser] = await Data.models.RobloxUser.findCreateFind({
		where: { guildId: guild.id, userId: userData.id.toString() },
		defaults: {
			guildId: guild.id,
			userId: userData.id.toString(),
		},
		attributes: ['blacklisted', 'blacklistReason', 'inSession', 'id', 'points'],
	});
	if (rbxUser.blacklisted) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setColor('Red')
					.setTitle('User is blacklisted')
					.setDescription(
						`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`) is blacklisted.\nReason: ${rbxUser.blacklistReason ?? 'none.'}`,
					)
					.setThumbnail(avatar.imageUrl),
			],
		});
		return;
	}
	if (rbxUser.inSession) {
		await interaction.reply({
			embeds: [
				defaultEmbed()
					.setColor('Red')
					.setTitle('User is already in a session')
					.setDescription(
						`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`) has already been added to the session.`,
					),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await rbxUser.update({ inSession: true, points: rbxUser.points + points });
	await interaction.reply({
		embeds: [
			defaultEmbed()
				.setColor('Green')
				.setTitle('Success')
				.setDescription(
					`Added \`${points}\` point${points === 1 ? '' : 's'} to \`${userData.name}\` (\`${userData.id}\`).\nThey now have \`${rbxUser.points}\` point${rbxUser.points === 1 ? '' : 's'}.`,
				)
				.setThumbnail(avatar.imageUrl),
		],
	});
	Logging.quickInfo(
		interaction,
		`Added ${points} point${points === 1 ? '' : 's'} to ${`\`${userData.displayName}\` (\`${userData.name}\`/\`${userData.id}\`). Marked them as in a session.`}`,
	);
};
