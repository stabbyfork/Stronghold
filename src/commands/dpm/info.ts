import {
	ChatInputCommandInteraction,
	ComponentBuilder,
	ComponentType,
	ContainerBuilder,
	MessageFlags,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { Data } from '../../data.js';
import { reportErrorToUser } from '../../utils/errorsUtils.js';
import { client } from '../../client.js';
import { GuildRelation, RelatedGuildAssociations } from '../../models/relatedGuild.js';
import { Guild } from '../../models/guild.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.info) => {
	const tag = getOption(interaction, args, 'tag')?.toLowerCase();
	if (!tag && !interaction.guild) {
		await reportErrorToUser(interaction, 'You must provide a guild tag or use this command in a guild.', true);
		return;
	}
	const dbGuild = tag
		? await Data.models.Guild.findOne({ where: { tag } })
		: await Data.models.Guild.findOne({
				where: { guildId: interaction.guild!.id },
			});
	if (!dbGuild) {
		await reportErrorToUser(interaction, 'A guild with the tag ' + tag + ' was not found in the database.', true);
		return;
	}
	const guild = client.guilds.cache.get(dbGuild.guildId) ?? (await client.guilds.fetch(dbGuild.guildId));
	const relatedGuilds = await Data.models.RelatedGuild.findAll({
		where: { guildId: guild.id },
		include: [RelatedGuildAssociations.TargetGuild],
	});
	const [allies, enemies, neutrals] = [[], [], []] as Guild[][];
	for (const rel of relatedGuilds) {
		if (!rel.targetGuild) continue;
		switch (rel.relation) {
			case GuildRelation.Ally:
				allies.push(rel.targetGuild);
				break;
			case GuildRelation.Enemy:
				enemies.push(rel.targetGuild);
				break;
			case GuildRelation.Neutral:
				neutrals.push(rel.targetGuild);
				break;
		}
	}
	await interaction.reply({
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## Guild information'),
				(text) => text.setContent(`Name: ${guild.name}`),
				(text) => text.setContent(`Tag: \`${dbGuild.tag}\``),
				(text) => text.setContent(`ID: \`${guild.id}\``),
				(text) => text.setContent(`Members: ${guild.memberCount}`),
				(text) => text.setContent(`Owner: ${userMention(guild.ownerId)} (\`${guild.ownerId}\`)`),
				(text) => text.setContent(`Created on: ${time(guild.createdAt, TimestampStyles.LongDate)}`),
				(text) =>
					text.setContent(`Allies: ${allies.length ? allies.map((a) => `\`${a.tag}\``).join(', ') : 'None'}`),
				(text) =>
					text.setContent(
						`Enemies: ${enemies.length ? enemies.map((a) => `\`${a.tag}\``).join(', ') : 'None'}`,
					),
				(text) =>
					text.setContent(
						`Neutral guilds: ${neutrals.length ? neutrals.map((a) => `\`${a.tag}\``).join(', ') : 'None'}`,
					),
			),
		],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { roles: [], users: [] },
	});
};
