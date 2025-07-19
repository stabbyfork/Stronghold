// AUTO-GENERATED AT SAT, 19 JUL 2025 08:12:18 GMT WITH 1 COMMAND

import type { CommandConstruct } from './types';

import ping from './commands/utility/ping';

export const commands = {
  "ping": ping,
} as const satisfies { [key: string]: CommandConstruct };
