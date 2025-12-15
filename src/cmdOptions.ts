// AUTO-GENERATED ON MON, 15 DEC 2025 15:26:24 GMT WITH 13 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands; SOURCE OF TRUTH

import type { CommandConstruct } from "./types/commandTypes.js";

export const commandOptions = {
activity: {
  "checks": {
    "create": {
      "channel": {
        "type": "channel",
        "required": true
      },
      "sequence": {
        "type": "string",
        "required": false
      },
      "interval": {
        "type": "string",
        "required": false
      },
      "max-strikes": {
        "type": "integer",
        "required": false
      }
    },
    "execute": {
      "override-sequence": {
        "type": "string",
        "required": false
      }
    }
  }
},
c: {
  "bp": {
    "rbx_name": {
      "type": "string",
      "required": true
    },
    "points": {
      "type": "integer",
      "required": false
    }
  }
},
dpm: {
  "setup": {
    "tag": {
      "type": "string",
      "required": true
    },
    "diplomacy_channel": {
      "type": "channel",
      "required": false
    },
    "game": {
      "type": "string",
      "required": false
    },
    "create_invite": {
      "type": "boolean",
      "required": false
    }
  },
  "info": {
    "tag": {
      "type": "string",
      "required": false
    }
  },
  "allies": {
    "add": {
      "tag": {
        "type": "string",
        "required": true
      },
      "message": {
        "type": "string",
        "required": false
      }
    },
    "remove": {
      "tag": {
        "type": "string",
        "required": true
      },
      "message": {
        "type": "string",
        "required": false
      }
    }
  },
  "enemies": {
    "add": {
      "tag": {
        "type": "string",
        "required": true
      },
      "message": {
        "type": "string",
        "required": false
      }
    },
    "remove": {
      "tag": {
        "type": "string",
        "required": true
      },
      "message": {
        "type": "string",
        "required": false
      }
    }
  },
  "neutrals": {
    "add": {
      "tag": {
        "type": "string",
        "required": true
      },
      "message": {
        "type": "string",
        "required": false
      }
    },
    "remove": {
      "tag": {
        "type": "string",
        "required": true
      }
    }
  },
  "send": {
    "tag": {
      "type": "string",
      "required": true
    },
    "message": {
      "type": "string",
      "required": true
    }
  }
},
permissions: {
  "roles": {
    "add": {
      "roles": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    },
    "remove": {
      "roles": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    },
    "list": {
      "role": {
        "type": "role",
        "required": true
      }
    },
    "clear": {
      "roles": {
        "type": "string",
        "required": true
      }
    },
    "set": {
      "roles": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    }
  },
  "users": {
    "add": {
      "users": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    },
    "remove": {
      "users": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    },
    "list": {
      "user": {
        "type": "user",
        "required": true
      }
    },
    "clear": {
      "users": {
        "type": "string",
        "required": true
      }
    },
    "set": {
      "users": {
        "type": "string",
        "required": true
      },
      "permissions": {
        "type": "string",
        "required": true
      }
    }
  },
  "get": {
    "user": {
      "type": "user",
      "required": false
    }
  }
},
proxy: {
  "add": {
    "target": {
      "type": "string",
      "required": true
    },
    "proxy": {
      "type": "string",
      "required": true
    }
  },
  "remove": {
    "proxy": {
      "type": "string",
      "required": true
    }
  }
},
ranking: {
  "view": {
    "user": {
      "type": "user",
      "required": false
    }
  },
  "points": {
    "lb": {
      "show_stackable": {
        "type": "boolean",
        "required": false
      }
    },
    "add": {
      "points": {
        "type": "integer",
        "required": true
      },
      "users": {
        "type": "string",
        "required": true
      }
    },
    "remove": {
      "points": {
        "type": "integer",
        "required": true
      },
      "users": {
        "type": "string",
        "required": true
      }
    },
    "set": {
      "points": {
        "type": "integer",
        "required": true
      },
      "users": {
        "type": "string",
        "required": true
      }
    }
  },
  "ranks": {
    "add": {
      "points": {
        "type": "integer",
        "required": true
      },
      "name": {
        "type": "string",
        "required": false
      },
      "existing_role": {
        "type": "role",
        "required": false
      },
      "limit": {
        "type": "integer",
        "required": false
      },
      "stackable": {
        "type": "boolean",
        "required": false
      },
      "show_in_ranking": {
        "type": "boolean",
        "required": false
      }
    },
    "add_bulk": {
      "data_text": {
        "type": "string",
        "required": false
      },
      "data_file": {
        "type": "attachment",
        "required": false
      }
    },
    "edit": {
      "name": {
        "type": "string",
        "required": true
      },
      "new_name": {
        "type": "string",
        "required": false
      },
      "points": {
        "type": "integer",
        "required": false
      },
      "limit": {
        "type": "integer",
        "required": false
      },
      "show_in_ranking": {
        "type": "boolean",
        "required": false
      },
      "stackable": {
        "type": "boolean",
        "required": false
      }
    },
    "remove": {
      "rank": {
        "type": "string",
        "required": true
      }
    },
    "in": {
      "rank": {
        "type": "string",
        "required": true
      }
    }
  }
},
rbx: {
  "blacklist": {
    "add": {
      "name": {
        "type": "string",
        "required": true
      },
      "reason": {
        "type": "string",
        "required": false
      }
    },
    "remove": {
      "name": {
        "type": "string",
        "required": true
      }
    },
    "check": {
      "names": {
        "type": "string",
        "required": true
      }
    }
  },
  "points": {
    "set": {
      "names": {
        "type": "string",
        "required": true
      },
      "points": {
        "type": "integer",
        "required": true
      }
    },
    "add": {
      "names": {
        "type": "string",
        "required": true
      },
      "points": {
        "type": "integer",
        "required": true
      }
    },
    "remove": {
      "names": {
        "type": "string",
        "required": true
      },
      "points": {
        "type": "integer",
        "required": true
      }
    },
    "get": {
      "name": {
        "type": "string",
        "required": true
      }
    }
  }
},
session: {
  "start": {
    "channel": {
      "type": "channel",
      "required": true
    },
    "image": {
      "type": "attachment",
      "required": false
    },
    "message_link": {
      "type": "string",
      "required": false
    }
  },
  "edit": {
    "edit_message": {
      "type": "boolean",
      "required": false
    },
    "edit_attachments": {
      "type": "boolean",
      "required": false
    },
    "image": {
      "type": "attachment",
      "required": false
    },
    "message_link": {
      "type": "string",
      "required": false
    }
  },
  "edit_default": {
    "channel": {
      "type": "channel",
      "required": true
    },
    "message_link": {
      "type": "string",
      "required": false
    }
  },
  "participants": {
    "type": {
      "required": true,
      "choices": [
        {
          "name": "Participants currently in the session",
          "value": 0
        },
        {
          "name": "All participants",
          "value": 1
        },
        {
          "name": "Participants who have met the time quota",
          "value": 2
        }
      ],
      "type": "integer"
    }
  },
  "kick": {
    "user": {
      "type": "user",
      "required": true
    }
  },
  "quota": {
    "time": {
      "type": "string",
      "required": false
    }
  },
  "remove": {
    "user": {
      "type": "user",
      "required": true
    }
  },
  "time": {
    "user": {
      "type": "user",
      "required": true
    }
  }
},
feedback: {
  "type": {
    "required": true,
    "choices": [
      {
        "name": "Bug",
        "value": 0
      },
      {
        "name": "Feature",
        "value": 1
      },
      {
        "name": "Miscellaneous",
        "value": 2
      },
      {
        "name": "Report a server",
        "value": 3
      }
    ],
    "type": "integer"
  }
},
help: {
  "command": {
    "type": "string",
    "required": false
  }
},
invite: {},
ping: {},
setup: {
  "force": {
    "type": "boolean",
    "required": false
  }
},
} as const satisfies {
	[key: string]: CommandConstruct['options'];
}

export type CommandList<T> = {
activity: {
  checks: {
    create: T,
    execute: T,
    cancel: T,
    pause: T,
    resume: T,
    info: T
  }
},
c: {
  bp: T
},
dpm: {
  setup: T,
  info: T,
  allies: {
    add: T,
    remove: T,
    list: T
  },
  enemies: {
    add: T,
    remove: T,
    list: T
  },
  neutrals: {
    add: T,
    remove: T,
    list: T
  },
  list: T,
  send: T
},
permissions: {
  roles: {
    add: T,
    remove: T,
    list: T,
    clear: T,
    set: T
  },
  users: {
    add: T,
    remove: T,
    list: T,
    clear: T,
    set: T
  },
  list: T,
  get: T
},
proxy: {
  add: T,
  remove: T,
  list: T,
  clear: T
},
ranking: {
  view: T,
  points: {
    lb: T,
    add: T,
    remove: T,
    set: T
  },
  promote: T,
  ranks: {
    list: T,
    add: T,
    add_bulk: T,
    edit: T,
    remove: T,
    in: T
  }
},
rbx: {
  blacklist: {
    add: T,
    remove: T,
    list: T,
    clear: T,
    check: T
  },
  points: {
    set: T,
    add: T,
    list: T,
    remove: T,
    get: T
  }
},
session: {
  status: T,
  start: T,
  quickstart: T,
  stop: T,
  edit: T,
  edit_default: T,
  participants: T,
  kick: T,
  quota: T,
  remove: T,
  time: T
},	
};
