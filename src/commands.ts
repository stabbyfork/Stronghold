// AUTO-GENERATED ON MON, 08 DEC 2025 15:59:27 GMT WITH 10 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands; SOURCE OF TRUTH

import type { CommandConstruct, CommandExecute } from './types/commandTypes.js';

import activity from './commands/activity.js';
import dpm from './commands/dpm.js';
import permissions from './commands/permissions.js';
import ranking from './commands/ranking.js';
import session from './commands/session.js';
import feedback from './commands/utility/feedback.js';
import help from './commands/utility/help.js';
import invite from './commands/utility/invite.js';
import ping from './commands/utility/ping.js';
import setup from './commands/utility/setup.js';

import activity_checks_create from './commands/activity/checks/create.js';
import activity_checks_execute from './commands/activity/checks/execute.js';
import activity_checks_cancel from './commands/activity/checks/cancel.js';
import activity_checks_pause from './commands/activity/checks/pause.js';
import activity_checks_resume from './commands/activity/checks/resume.js';
import activity_checks_info from './commands/activity/checks/info.js';
import dpm_setup from './commands/dpm/setup.js';
import dpm_info from './commands/dpm/info.js';
import dpm_allies_add from './commands/dpm/allies/add.js';
import dpm_allies_remove from './commands/dpm/allies/remove.js';
import dpm_allies_list from './commands/dpm/allies/list.js';
import dpm_enemies_add from './commands/dpm/enemies/add.js';
import dpm_enemies_remove from './commands/dpm/enemies/remove.js';
import dpm_enemies_list from './commands/dpm/enemies/list.js';
import dpm_neutrals_add from './commands/dpm/neutrals/add.js';
import dpm_neutrals_remove from './commands/dpm/neutrals/remove.js';
import dpm_neutrals_list from './commands/dpm/neutrals/list.js';
import dpm_list from './commands/dpm/list.js';
import dpm_send from './commands/dpm/send.js';
import permissions_roles_add from './commands/permissions/roles/add.js';
import permissions_roles_remove from './commands/permissions/roles/remove.js';
import permissions_roles_list from './commands/permissions/roles/list.js';
import permissions_roles_clear from './commands/permissions/roles/clear.js';
import permissions_roles_set from './commands/permissions/roles/set.js';
import permissions_users_add from './commands/permissions/users/add.js';
import permissions_users_remove from './commands/permissions/users/remove.js';
import permissions_users_list from './commands/permissions/users/list.js';
import permissions_users_clear from './commands/permissions/users/clear.js';
import permissions_users_set from './commands/permissions/users/set.js';
import permissions_list from './commands/permissions/list.js';
import permissions_get from './commands/permissions/get.js';
import ranking_view from './commands/ranking/view.js';
import ranking_points_lb from './commands/ranking/points/lb.js';
import ranking_points_add from './commands/ranking/points/add.js';
import ranking_points_remove from './commands/ranking/points/remove.js';
import ranking_points_set from './commands/ranking/points/set.js';
import ranking_promote from './commands/ranking/promote.js';
import ranking_ranks_list from './commands/ranking/ranks/list.js';
import ranking_ranks_add from './commands/ranking/ranks/add.js';
import ranking_ranks_add_bulk from './commands/ranking/ranks/add_bulk.js';
import ranking_ranks_edit from './commands/ranking/ranks/edit.js';
import ranking_ranks_remove from './commands/ranking/ranks/remove.js';
import ranking_ranks_in from './commands/ranking/ranks/in.js';
import session_status from './commands/session/status.js';
import session_start from './commands/session/start.js';
import session_quickstart from './commands/session/quickstart.js';
import session_stop from './commands/session/stop.js';
import session_edit from './commands/session/edit.js';
import session_edit_default from './commands/session/edit_default.js';
import session_participants from './commands/session/participants.js';
import session_kick from './commands/session/kick.js';
import session_quota from './commands/session/quota.js';
import session_remove from './commands/session/remove.js';
import session_time from './commands/session/time.js';

export const commands = {
  'activity': activity,
  'dpm': dpm,
  'permissions': permissions,
  'ranking': ranking,
  'session': session,
  'feedback': feedback,
  'help': help,
  'invite': invite,
  'ping': ping,
  'setup': setup,
} as const satisfies { [key: string]: CommandConstruct<boolean, any> };

export const subcommands = {
activity: {
  checks: {
    create: activity_checks_create,
    execute: activity_checks_execute,
    cancel: activity_checks_cancel,
    pause: activity_checks_pause,
    resume: activity_checks_resume,
    info: activity_checks_info
  }
},
dpm: {
  setup: dpm_setup,
  info: dpm_info,
  allies: {
    add: dpm_allies_add,
    remove: dpm_allies_remove,
    list: dpm_allies_list
  },
  enemies: {
    add: dpm_enemies_add,
    remove: dpm_enemies_remove,
    list: dpm_enemies_list
  },
  neutrals: {
    add: dpm_neutrals_add,
    remove: dpm_neutrals_remove,
    list: dpm_neutrals_list
  },
  list: dpm_list,
  send: dpm_send
},
permissions: {
  roles: {
    add: permissions_roles_add,
    remove: permissions_roles_remove,
    list: permissions_roles_list,
    clear: permissions_roles_clear,
    set: permissions_roles_set
  },
  users: {
    add: permissions_users_add,
    remove: permissions_users_remove,
    list: permissions_users_list,
    clear: permissions_users_clear,
    set: permissions_users_set
  },
  list: permissions_list,
  get: permissions_get
},
ranking: {
  view: ranking_view,
  points: {
    lb: ranking_points_lb,
    add: ranking_points_add,
    remove: ranking_points_remove,
    set: ranking_points_set
  },
  promote: ranking_promote,
  ranks: {
    list: ranking_ranks_list,
    add: ranking_ranks_add,
    add_bulk: ranking_ranks_add_bulk,
    edit: ranking_ranks_edit,
    remove: ranking_ranks_remove,
    in: ranking_ranks_in
  }
},
session: {
  status: session_status,
  start: session_start,
  quickstart: session_quickstart,
  stop: session_stop,
  edit: session_edit,
  edit_default: session_edit_default,
  participants: session_participants,
  kick: session_kick,
  quota: session_quota,
  remove: session_remove,
  time: session_time
},
} as const satisfies {
	[K in keyof Partial<typeof commands>]: { [key: string]: CommandExecute<any> | { [key: string]: CommandExecute<any> } };
};
