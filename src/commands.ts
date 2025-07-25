// AUTO-GENERATED ON FRI, 25 JUL 2025 21:54:34 GMT WITH 5 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands; SOURCE OF TRUTH

import type { CommandConstruct, CommandExecute } from './types';

import ranking from './commands/ranking.ts';
import roles from './commands/roles.ts';
import session from './commands/session.ts';
import help from './commands/utility/help.ts';
import ping from './commands/utility/ping.ts';

import ranking_points_view from './commands/ranking/points/view.ts';
import ranking_points_add from './commands/ranking/points/add.ts';
import ranking_points_remove from './commands/ranking/points/remove.ts';
import ranking_ranks_view from './commands/ranking/ranks/view.ts';
import ranking_ranks_add from './commands/ranking/ranks/add.ts';
import ranking_ranks_remove from './commands/ranking/ranks/remove.ts';
import session_status from './commands/session/status.ts';
import session_start from './commands/session/start.ts';
import session_quickstart from './commands/session/quickstart.ts';
import session_stop from './commands/session/stop.ts';
import session_join from './commands/session/join.ts';
import session_edit from './commands/session/edit.ts';

export const commands = {
  'ranking': ranking,
  'roles': roles,
  'session': session,
  'help': help,
  'ping': ping,
} as const satisfies { [key: string]: CommandConstruct };

export const subcommands = {
  ranking: {
  points: {
    view: ranking_points_view,
    add: ranking_points_add,
    remove: ranking_points_remove
  },
  ranks: {
    view: ranking_ranks_view,
    add: ranking_ranks_add,
    remove: ranking_ranks_remove
  }
},
  session: {
  status: session_status,
  start: session_start,
  quickstart: session_quickstart,
  stop: session_stop,
  join: session_join,
  edit: session_edit
},
} as const satisfies {
	[key in keyof Partial<typeof commands>]:
		| { [key: string]: CommandExecute | { [key: string]: CommandExecute } }
		| CommandExecute;
};
