# Character System

> 

NextVM separates the concept of **User** (a real person) from
**Character** (an in-game identity). A user can own multiple
characters, switch between them in-game, and the framework guarantees
that every per-character piece of state is isolated.

## User vs Character

| Concept | Scope | Examples |
|---|---|---|
| User | Persists across characters | License, Discord, Steam, ban status, admin permissions, Tebex purchases |
| Character | Isolated per character | Name, cash, bank, job, inventory, position, appearance, vehicles, criminal record |

A user with three characters has **three completely separate game
states**. Cash, jobs, inventory, vehicles — none of it leaks between
characters.

## DB schema

The two framework tables are defined in `@nextvm/db`:

```sql
CREATE TABLE nextv_users (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  license     VARCHAR(50) UNIQUE,
  discord     VARCHAR(30) NULL,
  steam       VARCHAR(30) NULL,
  lastSeen    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  banned      BOOLEAN DEFAULT 0
);

CREATE TABLE nextv_characters (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  userId      INT REFERENCES nextv_users(id),
  slot        INT,                 -- 1..5 by default
  firstName   VARCHAR(50),
  lastName    VARCHAR(50),
  dateOfBirth VARCHAR(10),
  gender      VARCHAR(10),
  cash        INT DEFAULT 0,
  bank        INT DEFAULT 500,
  job         VARCHAR(50) DEFAULT 'unemployed',
  position    JSON,
  appearance  JSON,
  metadata    JSON,
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastPlayed  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The `nextvm db:migrate` CLI applies the initial migration that
creates these tables.

## Character lifecycle


1. **Player connects** → User record loaded or created from identifiers
2. **Player enters routing bucket 0** (or a dedicated character-select
   bucket) → character selection NUI shown
3. **Player selects or creates a character** → character data loaded
   from DB into the state management
4. **`onPlayerReady` fires** → modules receive the loaded character
5. **Player disconnects** → character data persisted to DB, state
   cleared
6. **Character switch** (without disconnect) → current character saved,
   new character loaded, `onCharacterSwitch` fires

## CharacterService

```typescript
import { CharacterService } from '@nextvm/core'
import { DbCharacterRepository } from '@nextvm/db'

const characters = new CharacterService({
  repository: new DbCharacterRepository(db),
  maxCharacters: 5,
})

// Step 1+2: load or create user, attach session
await characters.loadOrCreateUser({
  source: player.source,
  license: player.identifiers.license,
  discord: player.identifiers.discord,
})

// Step 3: load + select a character
await characters.loadAndSelectCharacter(source, charId)

// Step 5: save + remove on disconnect
await characters.saveAndRemoveSession(source)
```

The repository is a **port** (interface) defined in `@nextvm/core`,
implemented by `@nextvm/db`. Tests use `InMemoryCharacterRepository`
from `@nextvm/test-utils` for fast, DB-free runs.

## charId scoping

Every per-player piece of state in NextVM is keyed by `charId`, never
by `source`. The reason: a single source (server ID) can switch between
multiple characters during a session, and the wrong key leaks state
across characters.

This is enforced everywhere:

- `playerState.set(charId, 'cash', 100)` — not `source`
- `inventoryState.get(charId, 'slots')` — not `source`
- `permissions.grantRole(source, 'admin')` — `source` is correct here
  because permissions belong to the **user**, not the character

The `nextvm validate` check soft-warns when it detects `source` being
used as a state key.

## Multi-character switch

When a player switches characters without disconnecting, the framework:

1. Saves the current character to the DB
2. Clears the in-memory state for that `charId`
3. Loads the new character from the DB
4. Fires `onCharacterSwitch(player, oldCharId, newCharId)` on every module
5. Modules use the hook to load per-character data they cache

```typescript
ctx.onCharacterSwitch(async (player, oldCharId, newCharId) => {
  cache.clear(oldCharId)
  await preload(newCharId)
})
```

## Routing bucket character selection

The character selection screen runs in a dedicated routing bucket so
the player doesn't see other players' peds, vehicles, or props. The
implementation lives in `@nextvm/natives` `RoutingService`:

```typescript
const selectInstance = routing.createInstance({
  label: `char_select_${source}`,
  players: [source],
})
// ... show NUI ...
routing.resetPlayer(source) // back to bucket 0
```

When a character is selected, the player is moved back to bucket 0
(main world) and spawned at their last position.

## See also

- [`@nextvm/core` CharacterService](/packages/core)
- [`@nextvm/db` schema](/packages/db)
- [](/reference/pla)
