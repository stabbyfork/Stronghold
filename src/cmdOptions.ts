// AUTO-GENERATED ON MON, 06 OCT 2025 14:03:26 GMT WITH 8 TOP-LEVEL COMMANDS AND DERIVED FROM src/commands; SOURCE OF TRUTH

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
session: {
  status: T,
  start: T,
  quickstart: T,
  stop: T,
  edit: T,
  edit_default: T,
  participants: T
},	
};
