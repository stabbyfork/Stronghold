import { Op } from '@sequelize/core';
import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Data } from '../../data.js';
import { AssetId, Assets } from '../../utils/assets.js';
import { listGuilds, Pages } from '../../utils/discordUtils.js';
import { Debug, reportErrorToUser } from '../../utils/errorsUtils.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import { Dui } from '@dui/core.js';
import { Config } from '../../config.js';
import { AdUtils } from '../../utils/adUtils.js';
import { DuiBuiltins } from '@dui/builtins.js';

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.dpm.list) => {
	const selectedGame = getOption(interaction, args, 'game');
	const nGuilds = await Data.models.Guild.count({
		where: {
			tag: { [Op.ne]: null },
		},
	});
	if (nGuilds === 0) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	const pages = new Pages({
		itemsPerPage: 5,
		totalItems: nGuilds,
		files: [new AttachmentBuilder(Assets.getById(AssetId.UnknownIcon), { name: AssetId.UnknownIcon })],
		createPage: async (index, perPage, files) => {
			const start = index * perPage;
			const targets = await Data.models.Guild.findAndCountAll({
				offset: start,
				limit: perPage,
				order: [
					['priority', 'DESC'],
					['createdAt', 'DESC'],
				],
				where: {
					tag: { [Op.ne]: null },
					...(selectedGame ? { dpmGame: selectedGame } : {}),
				},
				attributes: ['guildId', 'tag', 'serverInvite', 'dpmGame'],
			});
			pages.setTotalItems(targets.count);
			// Assumes that the command is always invoked in a guild channel, so interaction.guildId is always defined
			const randomAd = await AdUtils.weightedChancedRandomAd(interaction.guildId!, interaction.user.id, 0.5);
			if (randomAd) {
				const resolvedColour = randomAd.colour
					? Dui.resolveAccentColor(randomAd.colour as Dui.Intrinsics['container']['accentColor'])
					: 'White';
				if (resolvedColour) {
					return [
						await listGuilds(targets.rows, files[0]),
						...Dui.render(
							DuiBuiltins.BannerAd(
								{
									content: randomAd.content,
									link: randomAd.link,
									imageUrl: randomAd.imageUrl,
									colour: resolvedColour,
									children: [],
									linkText: randomAd.linkText,
								},
								{},
							),
						).components,
					];
				} else {
					Debug.error('Invalid accent color for ad:', JSON.stringify(randomAd));
				}
			}
			return listGuilds(targets.rows, files[0]);
		},
	});
	if (!(await Data.models.Guild.findOne())) {
		await reportErrorToUser(interaction, 'No guilds found', true);
		return;
	}
	await pages.replyTo(interaction, false, [0]);
};
