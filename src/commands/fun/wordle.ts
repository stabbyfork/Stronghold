import { ChatInputCommandInteraction, ComponentBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { commandOptions } from '../../cmdOptions.js';
import { getOption } from '../../utils/subcommandsUtils.js';
import fetch from 'node-fetch';
import { Errors } from '../../types/errors.js';
import { Worker } from 'node:worker_threads';

/** User ID to guesses for wordle */
const wordleMap = new Map<string, string[]>();

export default async (interaction: ChatInputCommandInteraction, args: typeof commandOptions.fun.wordle) => {
	const word = getOption(interaction, args, 'word');
	const resp = await fetch('https://wordle-api.vercel.app/api/wordle', {
		body: JSON.stringify({ guess: word }),
		method: 'POST',
	});
	const data = (await resp.json()) as
		| {
				guess: string;
				was_correct: true;
		  }
		| {
				guess: string;
				was_correct: false;
				character_info: {
					char: string;
					scoring: {
						in_word: false;
						correct_idx: false;
					};
				}[];
		  };
	if (!data) {
		throw new Errors.ThirdPartyError('Failed to get wordle data');
	}

	const guesses =
		wordleMap.get(interaction.user.id) ?? wordleMap.set(interaction.user.id, []).get(interaction.user.id)!;
	let formattedWord = word.split('');
	for (let i = 0; i < data.character_info.length; i++) {
		const charInfo = data.character_info[i];
		const scoring = charInfo.scoring;
		formattedWord[i] = scoring.correct_idx
			? `**[2;33m${charInfo.char}[0m**`
			: scoring.in_word
				? `*[2;32m${charInfo.char}[0m*`
				: charInfo.char;
	}
	guesses.push(formattedWord.join(''));
	if (guesses.length >= 6) {
		await interaction.reply({
			components: [
				new TextDisplayBuilder({
					content: 'You lost! The word was',
				}),
				new TextDisplayBuilder({
					content: `Your guesses were:\n\`\`\`ansi\n${guesses.join(', ')}\n\`\`\``,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.reply({
		components: [
			new TextDisplayBuilder({
				content: 'Guesses:\n```ansi\n' + guesses.join(', ') + '\n```',
			}),
			new TextDisplayBuilder({
				content: 'You have ' + (6 - guesses.length) + ' guesses left.',
			}),
		],
		flags: MessageFlags.Ephemeral,
	});
};
