// AUTO-GENERATED ON MON, 28 JUL 2025 19:45:44 GMT WITH 6 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands; SOURCE OF TRUTH

import type { CommandConstruct, CommandExecute } from './types.js';

import activity from './commands/activity.js';
import ranking from './commands/ranking.js';
import roles from './commands/roles.js';
import session from './commands/session.js';
import help from './commands/utility/help.js';
import setup from './commands/utility/setup.js';

import activity_checks_create from './commands/activity/checks/create.js';
import activity_checks_execute from './commands/activity/checks/execute.js';
import activity_checks_cancel from './commands/activity/checks/cancel.js';
import ranking_points_view from './commands/ranking/points/view.js';
import ranking_points_add from './commands/ranking/points/add.js';
import ranking_points_remove from './commands/ranking/points/remove.js';
import ranking_ranks_view from './commands/ranking/ranks/view.js';
import ranking_ranks_add from './commands/ranking/ranks/add.js';
import ranking_ranks_remove from './commands/ranking/ranks/remove.js';
import session_status from './commands/session/status.js';
import session_start from './commands/session/start.js';
import session_quickstart from './commands/session/quickstart.js';
import session_stop from './commands/session/stop.js';
import session_join from './commands/session/join.js';
import session_edit from './commands/session/edit.js';

export const commands = {
  'activity': activity,
  'ranking': ranking,
  'roles': roles,
  'session': session,
  'help': help,
  'setup': setup,
} as const satisfies { [key: string]: CommandConstruct };

export const subcommands = {
  activity: {
  checks: {
    create: activity_checks_create,
    execute: activity_checks_execute,
    cancel: activity_checks_cancel
  }
},
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
