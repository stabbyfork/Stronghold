// AUTO-GENERATED AT MON, 21 JUL 2025 12:29:15 GMT WITH 4 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands

import type { CommandConstruct, SubcommandMap, SubcommandPaths } from './types';

import ranking from './commands/ranking';
import session from './commands/session';
import help from './commands/utility/help';
import ping from './commands/utility/ping';

export const commands = {
  "ranking": ranking,
  "session": session,
  "help": help,
  "ping": ping,
} as const satisfies { [key: string]: CommandConstruct };

export const subcommands = {
  "ranking": {
  "points": {
    "view": "ranking points view",
    "add": "ranking points add",
    "remove": "ranking points remove"
  },
  "ranks": {
    "view": "ranking ranks view"
  }
},
  "session": {
  "status": "session status",
  "start": "session start",
  "quickstart": "session quickstart",
  "stop": "session stop",
  "join": "session join",
  "edit": "session edit"
},
  "help": "help",
  "ping": "ping",
} as const satisfies { [key in keyof typeof commands]: SubcommandMap | string };
