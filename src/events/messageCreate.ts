import { Events } from 'discord.js';
import { createEvent } from '../types/eventTypes.js';
import { DPM } from '../utils/diplomacyUtils.js';
import { Data } from '../data.js';

export default createEvent({
	name: Events.MessageCreate,
	once: false,
	execute: async (message) => {
		console.log('received message');
		if (message.author.bot) return;
		if (message.mentions.has(message.client.user) && message.guild && message.channel.isThread()) {
			console.log("it's a thread and satisfies reequirements");
			const dpmChannel = await DPM.getChannel(message.guild);
			const thread = message.channel;
			const parent = message.channel.parent;
			if (parent?.id === dpmChannel[0].id) {
				console.log('it is a dpm thread');
				const relation = await Data.models.RelatedGuild.findOne({ where: { sourceThreadId: thread.id } });
				if (!relation) {
					message.reply('No relation found.');
					return;
				}
				console.log('relation found, sending');
				await DPM.transaction(
					{ source: message.guild, target: relation.targetGuildId },
					DPM.TransactionType.MessageSend,
					{ message: message.content, author: message.author },
				);
			}
		}
	},
});
