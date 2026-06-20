---
name: narration-migration
description: |
    Migrate game action messaging from addMessage calls to the structured narration system (pushFrame/pushClause + renderers).
    Use when migrating a GameAction's messages, adding new verbs, or removing effect:/effectArgs: from card abilities.
---

# Narration Migration Skill

Migrate `addMessage` calls and `effect:`/`effectArgs:` card properties to the structured narration system: push frame+clause records into the narration buffer, add renderers to NarrationRenderer.js, and let the EventWindow auto-flush produce the chat messages.

## Architecture Overview

### Key Files

| File                                | Role                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/game/Narration.js`          | Buffer that collects frame+clause records. Fluent API: `pushFrame({...}).pushClause({...})`                                                                 |
| `server/game/NarrationRenderer.js`  | Verb-keyed render functions that convert frames+clauses into `addMessage` calls. Also houses `narrateEffects` for CardLastingEffectAction effect narrators. |
| `server/game/Events/EventWindow.js` | Auto-flushes `game.narration.flush()` at the end of every event window pipeline.                                                                            |
| `server/game/GameActions/*.js`      | Each GameAction can override `narrate()` returning `true` to suppress the default effectMsg. Push narration in `getEvent()` handler.                        |

### Flow

1. GameAction's `narrate()` returns `true` → suppresses default `effectMsg` rendering
2. Inside `getEvent()` handler, push frame+clause to `context.game.narration`
3. EventWindow pipeline completes → auto-flush renders all buffered frames via their verb-keyed renderer
4. Renderer calls `narration.game.addMessage(...)` to produce the final chat line

### Why NOT flush explicitly

Do NOT call `.flush()` inside event handlers. The EventWindow auto-flushes at the end of its pipeline, which ensures correct message ordering:

-   The handler pushes frames → EventWindow continues (checkGameState, checkForSubEvent, reaction) → flush step runs
-   Nested EventWindows (from `resolveAbility`) flush independently in their own pipeline
-   Explicit flush would cause messages to appear before nested effects resolve their own narration

Exception: Only flush explicitly when narration must render OUTSIDE an EventWindow (extremely rare).

## Migration Pattern

### Step 1: Make `narrate()` return true

```js
narrate() {
    return true;
}
```

This suppresses the default `effectMsg` system. The action now owns its own messaging.

### Step 2: Push frame+clause in `getEvent()` handler

```js
getEvent(card, context) {
    return super.createEvent(EVENTS.someEvent, { card, context }, (event) => {
        context.game.narration.pushFrame({
            verb: 'myVerb',
            player: context.player,
            source: context.source,
            ability: context.ability
        }).pushClause({
            verb: 'myVerb',
            args: { /* structured data for the renderer */ }
        });

        // ... rest of event handler
    });
}
```

**Frame fields:**

-   `verb` (string) — key into the renderers map
-   `player` — the acting player (for renderer to use)
-   `source` — the resolving card
-   `ability` — the ability context (for `describeSource()`)

**Clause fields:**

-   `verb` (string) — typically matches the frame verb, but can differ for multi-clause frames
-   `args` (object) — structured data the renderer needs (cards, amounts, locations, etc.)

### Step 3: Add renderer to NarrationRenderer.js

```js
function renderMyVerb(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'myVerb');
    if (!clause) {
        return;
    }

    narration.game.addMessage(
        '{0} does something to {1}',
        narration.describeSource(frame), // "{Card}'s {category}" or "{Card}'s {category} from {grantedBy}"
        clause.args.someArg
    );
}
```

Then register in the `renderers` map at the bottom of NarrationRenderer.js:

```js
const renderers = {
    // ... existing entries (keep alphabetical)
    myVerb: renderMyVerb
};
```

### Step 4: Remove `effect:`/`effectArgs:` from card abilities

When a GameAction now narrates via the system, any card that had `effect:` or `effectArgs:` for that action's output should have those properties removed. The narration system replaces them.

### Step 5: Add/update message tests

Tests go in `test/server/messages/` using `toHaveAllChatMessagesBe`:

```js
expect(this).toHaveAllChatMessagesBe([
    'player1 plays Card Name',
    "Card Name's play ability does something"
]);
```

## Implementation Rules

### Exhaustive switch with throwing default

Every `switch` statement in narration helpers MUST explicitly handle every expected case and `throw` in the `default` branch:

```js
switch (location) {
    case 'hand':
        return ''; // explicit empty — no location text needed
    case 'deck':
        return { message: fmt(" from the top of {0}'s deck", [owner]) };
    case 'discard':
        return { message: fmt(" from {0}'s discard", [owner]) };
    case 'archives':
        return { message: fmt(" from {0}'s archives", [owner]) };
    case 'under':
        return { message: fmt(' from under {0}', [owner]) };
    case 'purged':
        return { message: fmt(' from purged', []) };
    default:
        throw new Error(`describeLocation: unhandled location '${location}'`);
}
```

When a case legitimately produces no output, add it as an explicit case returning `''` so the throwing default is only reached for truly unhandled values.

### Never hide narration for custom messages — remove the custom messages

When a GameAction produces narration, do NOT suppress that narration when a card has `effect:`/`effectArgs:`. Instead, remove `effect:`/`effectArgs:` from the card. The narration system replaces those properties entirely.

### describeSource() for attribution

Use `narration.describeSource(frame)` to get the attribution string. It handles:

-   Regular cards: `"{Card}'s {category}"` (e.g. "Wild Wormhole's play ability")
-   Granted abilities: `"{Card}'s {category} from {grantedBy}"`
-   Bonus icon sources: `"{Card}'s {icon} bonus icon"`

### describeLocation() for origin zones

When narrating plays from non-hand zones, use the `describeLocation` helper which returns either empty string (hand) or a formatted `" from ..."` suffix. The owner field should be:

-   `card.owner` (the player) for deck/discard/archives/hand
-   `card.parent` (the parent card) for 'under' location

### Capture mutable state before event resolution

Always snapshot location/owner/parent BEFORE the event handler runs, since resolution may move the card:

```js
const originLocation = card.location;
const originOwner = card.location === 'under' ? card.parent : card.owner;
```

### Multiple frames in one handler

A single event handler can push multiple frames. Each frame becomes a separate chat line:

```js
// First: the play announcement
context.game.narration.pushFrame({ verb: 'abilityPlay', ... }).pushClause({ ... });
// Second: the cannot-play restriction
context.game.narration.pushFrame({ verb: 'cannotPlay', ... }).pushClause({ ... });
```

Both will render as separate lines when the EventWindow flushes.

## Existing Verbs (registered renderers)

| Verb                              | Renderer                              | Purpose                                  |
| --------------------------------- | ------------------------------------- | ---------------------------------------- |
| `abilityDraw`                     | renderDrawAnnouncement                | Draw from ability effect                 |
| `abilityPlay`                     | renderAbilityPlay                     | Play card from ability effect            |
| `bonusAmber`                      | renderBonusAmber                      | Bonus amber icon                         |
| `bonusDiscard`                    | renderBonusDiscard                    | Bonus discard icon                       |
| `bonusDraw`                       | renderDrawAnnouncement                | Bonus draw icon                          |
| `cannotPlay`                      | renderCannotPlay                      | Card revealed but cannot be played       |
| `cannotPlayHidden`                | renderCannotPlayHidden                | Hidden card cannot be played (no reveal) |
| `capture`                         | renderCapture                         | Capture amber                            |
| `changeHouse`                     | renderChangeHouse                     | House change effect                      |
| `copyCard`                        | renderCopyCard                        | Copy card effect                         |
| `fulfillProphecy`                 | renderFulfillProphecy                 | Prophecy fulfillment                     |
| `giveAmber`                       | renderTransfer                        | Give amber to opponent                   |
| `lastingAbilityTrigger`           | renderLastingAbilityTrigger           | Triggered ability activation             |
| `mulligan`                        | renderMulligan                        | Hand mulligan                            |
| `pay`                             | renderTransfer                        | Pay amber                                |
| `reap`                            | renderReap                            | Reap action                              |
| `refillDraw`                      | renderDrawAnnouncement                | End-of-turn refill draw                  |
| `resolveBonusIconAs`              | renderResolveBonusIconAs              | Bonus icon resolved as different type    |
| `resolveBonusIconsAdditionalTime` | renderResolveBonusIconsAdditionalTime | Extra bonus icon resolution              |
| `resolveFate`                     | renderResolveFate                     | Fate resolution                          |
| `shedChains`                      | renderShedChains                      | Chain shedding                           |
| `takeControl`                     | renderControl                         | Take control of card                     |

## Effect Narrators (for CardLastingEffectAction)

Effect narrators are registered in NarrationRenderer.js via `narrateEffects`. They handle effects applied by `ability.actions.cardLastingEffect()`:

```js
// In NarrationRenderer.js
function narrateResolveBonusIconsAdditionalTime(context, card) {
    context.game.narration
        .pushFrame({
            verb: 'resolveBonusIconsAdditionalTime',
            player: context.player,
            source: context.source,
            ability: context.ability
        })
        .pushClause({
            verb: 'resolveBonusIconsAdditionalTime',
            args: { card }
        });
}
```

Register in `effectNarrators` map and ensure `narrateEffects.hasNarration(effects)` returns true for effects with registered narrators.

## Common Pitfalls

1. **Don't call `.flush()` in handlers** — EventWindow does this automatically
2. **Don't check for `effect:` to suppress narration** — remove `effect:` from cards instead
3. **Don't use `addMessage` in GameActions that have narration** — use pushFrame/pushClause exclusively
4. **Capture state before event resolution** — card.location/owner/parent may change
5. **Always throw in default switch branches** — catches unhandled values immediately
6. **Keep renderers map alphabetical** — easier to scan
7. **Test with `toHaveAllChatMessagesBe`** — not individual message assertions

## Reference: PlayCardAction (Complete Example)

PlayCardAction is a fully migrated example showing all patterns:

-   `narrate()` returns `true`
-   Captures `originLocation`/`originOwner` before event
-   Pushes `abilityPlay` frame when card is revealed (not hidden)
-   Pushes `cannotPlayHidden` or `cannotPlay` frame for blocked plays
-   No explicit flush — relies on EventWindow auto-flush
-   Cards that used `effect:`/`effectArgs:` with playCard had those properties removed

See `server/game/GameActions/PlayCardAction.js` for the implementation.
