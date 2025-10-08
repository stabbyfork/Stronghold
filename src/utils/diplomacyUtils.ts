import { ChatInputCommandInteraction, Guild } from 'discord.js';
import { Data } from '../data.js';
import { ErrorReplies } from '../types/errors.js';
import { reportErrorToUser, constructError } from './errorsUtils.js';
import { GuildRelation } from '../models/relatedGuild.js';
import { Logging } from './loggingUtils.js';

export async function isDiploReady(guild: Guild) {
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guild.id } });
	if (!dbGuild) return false;
	return dbGuild.tag !== null;
}

export enum ChangeType {
	Remove,
	Add,
}

export async function changeRelation({
	interaction,
	relationTag,
	changeType,
	newRelation,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType.Add;
	newRelation: GuildRelation;
}): Promise<boolean>;
export async function changeRelation({
	interaction,
	relationTag,
	changeType,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType.Remove;
}): Promise<boolean>;
export async function changeRelation({
	interaction,
	relationTag,
	changeType,
	newRelation,
}: {
	interaction: ChatInputCommandInteraction;
	relationTag: string;
	changeType: ChangeType;
	newRelation?: GuildRelation;
}): Promise<boolean> {
	const guildId = interaction.guildId;
	if (!guildId) {
		await reportErrorToUser(interaction, constructError([ErrorReplies.InteractionHasNoGuild]), true);
		return false;
	}
	const dbGuild = await Data.models.Guild.findOne({ where: { guildId: guildId } });
	if (!dbGuild) {
		await reportErrorToUser(
			interaction,
			constructError([ErrorReplies.OnlySubstitute, ErrorReplies.ReportToOwner], 'Guild not found in database'),
			true,
		);
		return false;
	}
	if (dbGuild.tag === relationTag) {
		await reportErrorToUser(interaction, 'Cannot change relation with the same guild.', true);
		return false;
	}
	await Data.mainDb.transaction(async (transaction) => {
		switch (changeType) {
			case ChangeType.Remove:
				{
					const targetGuild = await Data.models.Guild.findOne({
						where: { tag: relationTag },
						transaction,
					});
					if (!targetGuild) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.GuildTagNotFound], relationTag),
							true,
						);
						return false;
					}
					const relatedGuild = await Data.models.RelatedGuild.findOne({
						where: { guildId: guildId, targetGuildId: targetGuild.guildId },
						transaction,
					});
					if (!relatedGuild) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.GuildNotRelated], relationTag),
							true,
						);
						return false;
					}
					await dbGuild.removeRelatedGuild(relatedGuild.id);
				}
				break;
			case ChangeType.Add:
				{
					const targetGuild = await Data.models.Guild.findOne({ where: { tag: relationTag }, transaction });
					if (!targetGuild) {
						await reportErrorToUser(
							interaction,
							constructError([ErrorReplies.GuildTagNotFound], relationTag),
							true,
						);
						return false;
					}
					const relatedGuild = await Data.models.RelatedGuild.findOne({
						where: { guildId: guildId, targetGuildId: targetGuild.guildId },
						transaction,
					});
					if (relatedGuild) {
						if (relatedGuild.relation === newRelation) {
							await reportErrorToUser(interaction, 'This guild already has this relation.', true);
							return false;
						}
						await relatedGuild.update({ relation: newRelation! }, { transaction });
					} else {
						await dbGuild.createRelatedGuild(
							{
								targetGuildId: targetGuild.guildId,
								relation: newRelation!,
							},
							{
								transaction,
							},
						);
					}
				}
				break;
		}
		await dbGuild.save();
	});
	Logging.quickInfo(
		interaction,
		changeType === ChangeType.Add
			? `Changed relation with \`${relationTag}\` to ${newRelation}.`
			: `Removed relation with \`${relationTag}\`.`,
	);
	return true;
}
