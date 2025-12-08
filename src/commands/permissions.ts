import { AutocompleteInteraction, SlashCommandBuilder } from 'discord.js';
import { createCommand } from '../types/commandTypes.js';
import { Permission } from '../utils/permissionsUtils.js';

async function genericPermAuto(interaction: AutocompleteInteraction) {
	const existingPerms = Array.from(
		new Set(
			interaction.options
				.getFocused()
				.split(' ')
				.map((x) => x.trim()),
		),
	);
	const possible = Object.values(Permission);
	if (existingPerms.length === 1 && existingPerms[0] === '') {
		await interaction.respond(possible.map((x) => ({ name: x, value: x })));
		return;
	}
	const lastPerm = existingPerms.at(-1) ?? existingPerms[0];
	if (possible.includes(lastPerm as Permission)) {
		await interaction.respond(
			possible
				.filter((x) => !existingPerms.includes(x))
				.map((x) => {
					const joined = [...existingPerms.filter((x) => possible.includes(x as Permission)), x].join(' ');
					return { name: joined, value: joined };
				}),
		);
		return;
	}
	const startsWithLast = possible
		.filter((x) => !existingPerms.includes(x))
		.filter((x) => x.toLowerCase().startsWith(lastPerm.toLowerCase()));
	await interaction.respond(
		startsWithLast.length === 0
			? possible.map((x) => ({ name: x, value: x }))
			: startsWithLast.map((x) => {
					const joined = [
						...existingPerms.slice(0, -1).filter((y) => possible.includes(y as Permission)),
						x,
					].join(' ');
					return { name: joined, value: joined };
				}),
	);
}

export default createCommand({
	data: new SlashCommandBuilder()
		.setName('permissions')
		.setDescription('Commands relating to bot-specific permission management')
		.addSubcommandGroup((group) =>
			group
				.setName('roles')
				.setDescription('Commands for role permissions')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add permissions to roles. See /permissions list for info')
						.addStringOption((option) =>
							option
								.setName('roles')
								.setDescription('List of roles to add permissions to (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to add (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove certain permissions from roles')
						.addStringOption((option) =>
							option
								.setName('roles')
								.setDescription('List of roles to remove permissions from (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to remove (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('list')
						.setDescription('All the permissions of a role. Omits user-specific perms.')
						.addRoleOption((option) =>
							option.setName('role').setDescription('Role to list the permissions of').setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('clear')
						.setDescription('Remove all permissions from a role or several roles')
						.addStringOption((option) =>
							option
								.setName('roles')
								.setDescription('Roles to remove all permissions from (mentions)')
								.setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('set')
						.setDescription('Set the permissions of certain roles')
						.addStringOption((option) =>
							option
								.setName('roles')
								.setDescription('Roles to set permissions of (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to set (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('users')
				.setDescription('Commands for user permissions')
				.addSubcommand((cmd) =>
					cmd
						.setName('add')
						.setDescription('Add a permission to a user or several users')
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to add permissions to (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to add (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('remove')
						.setDescription('Remove a permission from a user or several users')
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to remove permissions from (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to remove (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('list')
						.setDescription('List all the permissions of a user. Omits role perms')
						.addUserOption((option) =>
							option.setName('user').setDescription('User to list the permissions of').setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('clear')
						.setDescription('Clear all permissions from a user or many users')
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to clear permissions from (mentions)')
								.setRequired(true),
						),
				)
				.addSubcommand((cmd) =>
					cmd
						.setName('set')
						.setDescription('Set the permissions of a user or many users')
						.addStringOption((option) =>
							option
								.setName('users')
								.setDescription('Users to set the permissions of (mentions)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('permissions')
								.setDescription('Permissions to set (names), separated by spaces')
								.setRequired(true)
								.setAutocomplete(true),
						),
				),
		)
		.addSubcommand((cmd) => cmd.setName('list').setDescription('List all possible permissions'))
		.addSubcommand((cmd) =>
			cmd
				.setName('get')
				.setDescription('Get the calculated (final) bot-specific permissions of a user')
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('User to get the calculated (user AND roles) permissions of')
						.setRequired(false),
				),
		),
	autocomplete: genericPermAuto,
});
