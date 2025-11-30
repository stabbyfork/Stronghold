import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Data } from '../../../data.js';
import { GuildRelation, RelatedGuildAssociations } from '../../../models/relatedGuild.js';
import { ErrorReplies } from '../../../types/errors.js';
import { AssetId, Assets } from '../../../utils/assets.js';
import { isDiploReady } from '../../../utils/diplomacyUtils.js';
import { listGuilds, Pages } from '../../../utils/discordUtils.js';
import { constructError, reportErrorToUser } from '../../../utils/errorsUtils.js';

export default async (interaction: ChatInputCommandInteraction) => {
	const guild = interaction.guild;
	if (!guild) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return;
	}
	if (!(await isDiploReady(interaction.guild))) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.DiploNotSetup]), true);
		return;
	}
	const member = interaction.member as GuildMember | null;
	if (!member) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoMember]), true);
		return;
	}
	const allies = await Data.models.RelatedGuild.findAndCountAll({
		where: {
			relation: GuildRelation.Ally,
			guildId: guild.id,
		},
		include: [
			{ model: Data.models.Guild, as: RelatedGuildAssociations.TargetGuild, attributes: ['tag', 'guildId'] },
		],
		distinct: true,
	});
	const pages = new Pages({
		itemsPerPage: 20,
		totalItems: allies.count,
		createPage: async (index, perPage) => {
			const start = index * perPage;
			/*new ContainerBuilder().addTextDisplayComponents(
				(text) => text.setContent('## List of allies'),
				(text) =>
					text.setContent(
						allies.count
							? allies.rows
									.slice(start, start + perPage)
									.map((a) =>
										a.targetGuild
											? `\`${a.targetGuild.tag}\``
											: `Unknown guild \`${a.targetGuildId}\``,
									)
									.join('\n')
							: 'No allies exist.',
					),
			);*/
			return listGuilds(
				allies.rows.slice(start, start + perPage).map((a) => a.targetGuild!),
				Assets.getAsFile(AssetId.DefaultGuildIcon),
				'List of allies',
			);
		},
	});
	await pages.replyTo(interaction, false);
};
