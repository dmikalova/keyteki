# Messaging system overhaul — exploration

> **Heads up:** this doc is not perfectly accurate, and has lines that are AI faff. Please focus on the log examples in section 4 as the most revised and concrete part of the proposal. The rest of the doc is in broad strokes.

> **Status:** Exploration / proposal. No code changes yet.

> **Note on the examples:** Card names are real KeyForge cards picked for memorable flavor, but the ability text quoted below may be _paraphrased_ or _hypothetical_ to illustrate a log shape. Don't grade these as card implementations — grade the log lines.

## Contents

1. [Intent](#1-intent)
2. [Style principles](#2-style-principles)
3. [Current architecture (as-is)](#3-current-architecture-as-is)
4. [Examples by ability / verb](#4-examples-by-ability--verb)
5. [Verb taxonomy](#5-verb-taxonomy)
6. [Design and implementation](#6-design-and-implementation)
7. [Testing strategy](#7-testing-strategy)
8. [Migration strategy](#8-migration-strategy)
9. [Deprecations](#9-deprecations)
10. [Terminology — internal vs KeyForge](#10-terminology--internal-vs-keyforge)

---

## 1. Intent

### 1.1 Goals

1. **Speak KeyForge.** The chat log should describe what's happening in KeyForge vernacular — _reap_, _fight_, _capture_, _archive_, _forge_, _flank_, _ward_, _enrage_, _stun_, _purge_, _fate_, _prophecy_ — and reserve plain-English connectives for the parts between the verbs.
2. **Drive the log from the engine, not from each card.** Each card today writes its own `effect` / `message` strings; many also call `addMessage` directly. We end up with three layers of message sources that don't agree on phrasing, ordering, attribution, or what counts as "one beat". The new system narrates from the resolved game events instead, so the card author writes game actions and the engine writes the log.
3. **Accurately portray what happened.** Today's log is full of events that resolve silently and outright lies (lines that paraphrase the card text instead of the result, attribute effects to the wrong source, or report what was attempted rather than what landed). The new system narrates from resolved game events, so every observable state change is on the log and every line matches the state it describes.

### 1.2 Why now

-   The current "uses X to …" template is awkward for nearly every ability category (fight, reap, fate, prophecy, omni, bonus icon).
-   A turn log we can both read sequentially _and_ collapse by use (visual "bubbles", see [§6.4](#64-the-useid-is-for-grouping-only--assign-it-lazily)).
-   The replay / spectator experience needs to read like commentary, not like a stack trace.

---

## 2. Style principles

Top guiding principles for all messaging changes in this overhaul are consistency and simplicity. If two designs are both accurate, prefer the one that keeps message shapes consistent across actions and uses the simpler, more predictable implementation. In situations where you see a simpler implementation that isn't strictly what the user asked for, either go with the simpler implementation if its clearly an improvement or ask for clarification on the desired shape and why.

### 2.1 Speak the game's verbs

KeyForge verbs head every log line. The verb is the action that just resolved or that the player just took. Connective prose (`and`, `but`, `to`, `from`, `due to`) wraps the verbs together into one sentence per resolved beat.

### 2.2 One line = all simultaneous events

Each log line is an **atomic and non-interruptible event**: it carries everything that resolves at the same instant under a single attribution. Nothing can fire between the events on one line — by definition, anything that fires in between is a separate beat and prints on its own line either before or after. Examples of events that share a line because they're simultaneous:

-   Reap + 1 amber gain ([§4.16](#416-reap-vanilla))
-   Fight damage to attacker and defender + any resulting destruction ([§4.21](#421-fight-vanilla))
-   Damage + ward removal ([§4.28](#428-damage-with-ward-single-target))
-   Multi-target damage to every creature + each creature's destruction ([§4.30](#430-damage-to-many-creatures-mixed-defenses))
-   Captured-amber returns when several creatures leave play in the same window ([§4.61](#461-captured-amber-returns-when-a-card-leaves-play))

For readability, we split damage and destruction into **two consecutive non-interruptible lines**: the damage line first, then a `Damage destroys ...` line immediately after. Nothing can resolve in between those two lines.

When a separate ability fires _because_ the first beat happened — an after-reap ability following a reap, a destroyed-triggered ability following damage, a constant ability reacting to a play — that's a new instant and a new line ([§4.17](#417-steal-urchins-after-reap-ability), [§4.35](#435-constant-ability-triggers-a-token-redeemer-amara)). The seam between two lines is exactly where interrupts and other in-between effects can fire. Conversely, two effects on one card's text that happen sequentially (Pestering Blow's "deal damage **and** enrage", [§4.32](#432-enrage-pestering-blow)) are separate beats even when the card grammar joins them with `and`.

### 2.3 One sentence, ordered clauses, for complex damage

Multi-target damage is one logical sentence with sub-clauses joined by `,` / `, but` / `.`, in a fixed order ([§6.7](#67-multi-damage-sentence-assembly)). The sentence is one log line even when it wraps visually.

### 2.4 Ability attribution: card + category, source only when needed

A **player-instigated** line names the player and the verb they took — `player1 plays Troll`, `player1 reaps with Urchin`, `player1 uses Bumpsy's action ability`. Everything that follows from that use is a **resolved-ability** line, and its head is just the ability itself:

```text
{card}'s {category} ability {verb-phrase}
```

`{category}` is a KeyForge category name: **action**, **play**, **before fight**, **after fight**, **after reap**, **hazardous**, **assault**, **fate**, **after play**, **constant**, **omni**, **bonus icon**. The card's own name is enough attribution **when the resolving card is the granting card**. When the ability was granted by a different source (upgrade, constant ability, prophecy), append `from {source}` — see [§4.13](#413-ability-granted-by-another-card-upgrade).

#### Why drop `{player} resolves … to`

KeyForge has **no reactions or choices outside the active player's turn** — every ability that fires during a turn is resolved by the active player, and the player-instigated line at the head of the bubble already names them. Saying `player1 resolves Bumpsy's action ability to gain 1 amber` on every line restates context the reader already has. `Bumpsy's action ability has player1 gain 1 amber` is enough: the ability is the grammatical subject and the verb agrees with it. Cross-player constants ([§4.36](#436-widespread-corruption-constant-reroute-of-amber), [§4.38](#438-bryozoarch-replaces-an-action-play-effect)) work the same way — the active player still resolves them, and the source card name plus the bubble's instigating line carry the attribution.

### 2.5 Always print a number, never silence

Zero is information. `steal 0 amber`, `capture 0 amber`, `deal 0 damage` all print. A missing line means _the ability didn't resolve_; a `0` line means _it resolved and the outcome was zero_.

> Exception: when the natural-language phrasing has a clean "nothing-happened" form, we use the phrase instead of the `0`. `readies nothing` doesn't print a `0` because "ready" isn't a count. **Heal** is the same: the per-target amount stays in the line, and the absence of valid targets reads as `from nothing` (`heal 1 damage from nothing`), not `heal 0 damage` — because the heal amount per target was always 1, what was zero is the number of eligible targets ([§4.6](#46-play-action-card--cleansing-wave-with-conditional-gain), [§4.46](#446-ready-as-a-game-action-not-a-phase)).

### 2.6 Flank, neighbors, position

Creatures enter the battleline at a flank, or deploy between two existing creatures. The log always says which:

-   `plays Troll on the right flank`
-   `deploys Ghosthawk between Urchin and Bumpsy`

Exception: when there are **no other creatures**, flank is meaningless and we omit it:

-   `plays Troll`

Token creatures follow the same placement rule: when a token creature enters play, the line must include `on the left flank`, `on the right flank`, or `deploys ... between ...`.

### 2.7 Lowercase keywords inline

KeyForge keywords are lowercase in prose: `use omni`, `unstun`, `ward`, `enrage`, `purge`, `fight`, `reap`. Card names stay Title-Cased.

### 2.8 Source → sink ordering

When a verb names both a source and a sink (capture, steal, move damage, redirect), the source comes first and the sink last. The reader's eye tracks the flow.

-   `capture {N} amber from {opponent} onto {host}` ([§4.19](#419-reap-capture-effect--urchin-opponent-has-0))
-   `steal {N} amber from {opponent}`
-   `move {N} damage from {target} to {target}`
-   `return {card} from play to {owner}'s hand`

### 2.9 Damage phrasing

For a single damage event, the line names the source, the amount, the target, and any modifiers, all in one clause. Per-target parens carry the full per-target detail (damage taken, armor / ward / invulnerable, prior damage if it matters for destruction):

-   Single target, vanilla: `deal {N} damage to {target}`
-   Per-target detail when modifiers apply: `deal damage to {target} ({N} damage, {modifier clause})`
-   Multiple targets, same amount, no modifiers: `deal {N} damage to {target1, target2, …}`
-   Multiple targets, mixed: `deal damage to Troll (2 damage prevented by armor and 3 damage dealt), Ganger Chieftain (2 damage prevented by ward), and Bumpsy (3 damage prevented by invulnerable)`

Modifier clauses, in fixed priority order when ranking inside a single target's parens:

1. `{N} damage prevented by invulnerable` — the damage didn't happen at all.
2. `{N} damage prevented by ward` — never "absorbs". The ward keyword token is consumed; the phrasing doesn't need to spell that out (compare `armor prevents`, which also doesn't restate that armor stays).
3. `{N} damage prevented by armor and {M} damage dealt`.

Destruction is emitted as a **separate line immediately after damage**: `Damage destroys {Name} ({N} damage)`, grouped with commas and `and` when multiple.

### 2.10 Keyword tokens, counters, damage

KeyForge has **no "status" noun**. Stun, ward, and enrage are **keywords** tracked by tokens placed on the creature; the log narrates them as verbs, never as statuses.

| Category                                      | Examples                           | Verb forms                                                                                                                            |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Keyword tokens** (placed / removed in play) | stun, ward, enrage                 | `stun {target}` / `unstun {target}`, `ward {target}` / `remove ward from {target}`, `enrage {target}` / `remove enrage from {target}` |
| **Counters** (numeric, accumulate)            | power, glory, doom, Aember-on-card | `place {N} {kind} counter(s) on {target}`, `remove {N} {kind} counter(s) from {target}`                                               |
| **Damage** (numeric, accumulate)              | damage tokens                      | `deal {N} damage to {target}`, `heal {N} damage from {target}`, `move {N} damage from {target} to {target}`                           |

Other KeyForge keywords (poison, splash, deploy, skirmish, taunt, hazardous, assault, elusive, etc.) aren't represented by tokens at all — they're intrinsic to the card or its ability. They don't get applied or removed; they shape the verb they qualify (`deal 1 poison damage`, `Chasm Vespid's splash damage deals 1 to Bumpsy`, `fights with Troll into an elusive Dodger`).

### 2.11 Amber phrasing

Amber uses a small set of verbs: **gain**, **lose**, **pay**, **spend**, **give**, **steal**, **capture**. "Pay" is for play costs (e.g. amber to play a card), "spend" is for forging a key, "give" is a transfer to another player with no cost framing, "lose" is forfeiture with no recipient. Amber pool is not named — `from {player}` is enough.

### 2.12 Zone movement vocabulary

Each verb spells out the source zone and destination zone explicitly so the log line is unambiguous on its own:

| Movement                                            | Verb                                               |
| --------------------------------------------------- | -------------------------------------------------- |
| from hand to discard                                | `discard {card} from {player}'s hand`              |
| from play to discard (destruction)                  | `destroy {card}`                                   |
| from play to discard (non-destroy)                  | `move {card} from play to {player}'s discard`      |
| from anywhere to purge                              | `purge {card} from {zone}`                         |
| from play to hand                                   | `return {card} from play to {player}'s hand`       |
| from play to deck                                   | `return {card} from play to {player}'s deck`       |
| from hand to archives (the player's archive action) | `archive {card}`                                   |
| from any other zone to archives                     | `put {card} into {player}'s archives`              |
| from archives to hand                               | `picks up {N} cards from their archives`           |
| to under another card (faceup)                      | `place {card} from {source} faceup under {host}`   |
| to under another card (facedown)                    | `place a card from {source} facedown under {host}` |
| from hand grafted onto a host                       | `graft {card} from {player}'s hand onto {host}`    |

The two archive verbs are distinct: `archive {card}` is the player's voluntary archive action ([Archives](https://archonarcana.com/Archives) keyword and end-of-turn option, source zone is the player's hand). `put {card} into {player}'s archives` is an effect-driven move from another zone — most commonly from play (abduct, [§4.43](#443-abduct-uxlyx-the-zookeeper)) but also from an opponent's archives or deck.

Grafting, masterplan, and prophecy activation each have their own card-specific verbs in the rules; we keep that distinction in the log rather than collapsing to a single `place under`. Purge is its own verb, never lumped with discard.

### 2.13 No colons in log lines

Avoid `:` as a structural separator. Prefer `,` / `.` / `and` / `but` / `to`. Colons read like API output, not narration.

### 2.14 Never go silent on resolved abilities

When an ability resolves with a zero outcome, the line still prints ([§2.5](#25-always-print-a-number-never-silence)). The exception is **no-op turn steps** — start-of-turn and end-of-turn boundaries are visual, not logged ([§5.3](#53-no-phase-as-line)).

A card moving to the discard pile is logged unless the move is **implied by another line** in the same beat — e.g. a destroyed creature's move-to-discard is not logged separately because the destruction line already implies it. Any other movement to discard (move from play, discard from hand, discarded by effect) gets its own line ([§6.8](#68-replacement-effects-and-the-discard-step)).

### 2.15 Visual grouping (bubbles)

Each player-instigated use opens a new visual group ("bubble"). All lines emitted between that use and the next use carry the same `useId` and are clustered visually by the client. Manual-mode commands ([§4.57](#457-manual-mode-commands)) inherit the active useId when one is open, sit between bubbles otherwise.

> The bubbles UI is **deferred** — narration records and `useId` come first; client clustering ships once the records are stable across the codebase ([§8](#8-migration-strategy)).

---

## 3. Current architecture (as-is)

### 3.1 Three layers that all write messages

1. **Ability declarations** — `effect`, `effectArgs`, `message`, `messageArgs` on `card.action({…})`, `card.play({…})`, `card.reap({…})`, `card.fight({…})`, `card.reaction({…})`.
2. **Game actions** — each `GameAction` has its own `effectMsg` / `getEffectMessage` that builds a phrase like "deal 3 damage to Troll" used in prompts and (sometimes) in chat.
3. **Ad-hoc `addMessage` calls** — ~50 sites across the codebase that bypass both layers and write directly to chat (forge, archive pickup, draw, fight setup, etc.).

Result: phrasing inconsistency, duplicated work, no single seam to i18n, no single seam to test, and cards encode message logic that is really game-engine logic.

### 3.2 What works today

-   `effect` strings give a card-level summary that prompts can show.
-   `addMessage(format, ...args)` flexes for free-form text and supports card / player formatters.
-   Tests assert exact strings via `toHaveAllChatMessagesBe`.

### 3.3 What needs replacing

-   The "uses X to …" template ([§5.1](#51-use--the-head-verb-thats-going-away)).
-   Per-card custom messages ([§5.2](#52-custom-card-messages)).
-   Direct `addMessage` for engine events.

---

## 4. Examples by ability / verb

**Format for each example:**

-   **Card text** — what the (real or paraphrased) ability says
-   **Today** — current log output (code block)
-   **Desired** — what we want the log to say (code block)

### 4.1 Play (creature) — vanilla

-   **Card text:** Troll, played onto an empty battleline.
-   **Desired (no other creatures):**

    ```text
    player1 plays Troll
    ```

-   **Desired (other creatures present, played to a flank):**

    ```text
    player1 plays Troll on the right flank
    ```

### 4.2 Play (creature with cost — Truebaru)

-   **Card text:** Truebaru — "Play: lose 3A to play this."
-   **Desired:**

    ```text
    player1 loses 3 amber in order to play Truebaru
    player1 plays Truebaru on the right flank
    ```

> Cost and play are separate lines so an interrupt can fire between them. Same template for all non-amber play costs — e.g. destroy cost (Rampaging Brutodon, [§4.3](#43-destroy-cost-rampaging-brutodon)). Chains aren't a play cost; they're an effect ([§4.4](#44-chain-effect-binding-irons)).

### 4.3 Destroy cost (Rampaging Brutodon)

Some plays cost destroying one of your own creatures. The cost is a separate line preceding the play, same shape as the amber cost in [§4.2](#42-play-creature-with-cost--truebaru).

-   **Card text:** Rampaging Brutodon — "Play: destroy one of your creatures."
-   **Desired (player chooses to destroy Bumpsy):**

    ```text
    player1 destroys Bumpsy in order to play Rampaging Brutodon
    player1 plays Rampaging Brutodon on the right flank
    ```

### 4.4 Chain effect (Binding Irons, Gateway to Dis)

Chains aren't a play cost — cards that involve chains apply the chain change as part of their play ability, narrated like any other effect. The verb is `gain` / `shed` for a player taking or removing chains on themselves and `give` / `remove` when the source assigns chains to another player.

-   **Card text:** Binding Irons — "Play: Your opponent gains 3 chains."
-   **Desired (chains given to the opponent):**

    ```text
    player1 plays Binding Irons
    Binding Irons's play ability gives player2 3 chains
    ```

-   **Card text:** Gateway to Dis — "Play: Destroy each creature. Gain 3 chains."
-   **Desired (self-takes chains; multi-effect ability, one line per effect per [§2.2](#22-one-line--all-simultaneous-events)):**

    ```text
    player1 plays Gateway to Dis
    Gateway to Dis's play ability destroys Troll, Bumpsy, Urchin, Dextre, and Ghosthawk
    Gateway to Dis's play ability gives player1 3 chains
    ```

> The chain track updates silently between events; only the gain / shed / give / remove line narrates. When chains affect a future draw count, both the per-card draws and the chain-shed-on-draw narrate normally ([§4.41](#441-drawing-cards-always-one-at-a-time)) — the draw-count reduction itself doesn't log per draw.

### 4.5 Play (upgrade — Rocket Boots on Urchin)

-   **Desired:**

    ```text
    player1 plays Rocket Boots, attaching to Urchin
    ```

### 4.6 Play (action card — Cleansing Wave with conditional gain)

Cleansing Wave is an **action card** played from hand — played, then its play ability resolves. "Heal" and "gain amber" are two distinct verbs, so they're two distinct lines ([§2.2](#22-one-line--all-simultaneous-events)).

-   **Card text:** Cleansing Wave — "Heal 1D from each friendly creature. If at least one creature was healed, gain 2A."
-   **Desired (creatures had damage):**

    ```text
    player1 plays Cleansing Wave
    Cleansing Wave's play ability heals 1 damage from Troll and Bumpsy
    Cleansing Wave's play ability has player1 gain 2 amber
    ```

-   **Desired (no creatures had damage):**

    ```text
    player1 plays Cleansing Wave
    Cleansing Wave's play ability heals 1 damage from nothing
    Cleansing Wave's play ability has player1 gain 0 amber
    ```

> The heal line keeps `1 damage` (the per-target amount that the card always heals) and uses `from nothing` for the empty-target case rather than `heal 0 damage` — a per-card exception to [§2.5](#25-always-print-a-number-never-silence). The conditional gain still narrates as `has player1 gain 0 amber` per the standard zero rule.

### 4.7 Play (action — Kerwollop, partial destruction)

-   **Card text:** Kerwollop — "Deal 1D to each creature. Gain 1A for each creature destroyed this way." Three enemy creatures hit; Troll and Bumpsy die.
-   **Desired:**

    ```text
    player1 plays Kerwollop
    Kerwollop's play ability deals 1 damage to Troll, Bumpsy, and Ganger Chieftain
    Damage destroys Troll (1 damage) and Bumpsy (1 damage)
    Kerwollop's play ability has player1 gain 2 amber
    ```

> Damage and destruction are two consecutive lines ([§6.7](#67-multi-damage-sentence-assembly)). The amber gain is a separate line — it's downstream of destruction count, not part of the damage window. **Destroyed-triggered abilities** (Redeemer Amara, etc.) resolve **between** the destruction line and the gain line, on their own lines ([§4.35](#435-constant-ability-triggers-a-token-redeemer-amara)).

### 4.8 Damage with per-target amounts (Sack of Coins)

When the source deals **different** amounts to different creatures, the per-target parens carry both the amount and any modifier — same shape as [§4.30](#430-damage-to-many-creatures-mixed-defenses).

-   **Card text:** Sack of Coins — "Play: Deal 1D to a creature for each A in your pool." Player has 6 amber; allocates 3 to Troll (no armor), 1 to Bumpsy (2 power, dies), 2 to Ganger Chieftain (4 power, 1 armor).
-   **Desired:**

    ```text
    player1 plays Sack of Coins
    Sack of Coins's play ability deals damage to Troll (3 damage), Bumpsy (1 damage), and Ganger Chieftain (1 damage prevented by armor and 1 damage dealt)
    Damage destroys Bumpsy (1 damage)
    ```

### 4.9 Modal choice (Senator Shrix)

-   **Card text:** Senator Shrix — "Play: capture 2A **or** deal 3D to a creature." Player chooses capture.
-   **Desired:**

    ```text
    player1 plays Senator Shrix
    Senator Shrix's play ability captures 2 amber from player2 onto Senator Shrix
    ```

### 4.10 Deploy

-   **Desired:**

    ```text
    player1 deploys Ghosthawk between Urchin and Bumpsy
    ```

> "Between" reads better than "to the left of X" because the player sees both neighbors at the new position.

### 4.11 Bonus icons (always one at a time)

-   **Card text:** Urchin played with 1 bonus amber, 1 bonus capture, 1 bonus draw.
-   **Desired:**

    ```text
    player1 plays Urchin on the right flank
    Urchin's bonus icon has player1 gain 1 amber
    Urchin's bonus icon captures 1 amber from player2 onto Urchin
    Urchin's bonus icon draws 1 card
    ```

-   **Card text:** Troll played with 1 bonus damage. The active player picks Bumpsy as the target.
-   **Desired:**

    ```text
    player1 plays Troll
    Troll's bonus icon deals 1 damage to Bumpsy
    ```

-   **Card text:** Troll played with 1 bonus +1 power counter. The active player picks Urchin as the target.
-   **Desired:**

    ```text
    player1 plays Troll
    Troll's bonus icon places 1 power counter on Urchin
    ```

-   **Card text:** Troll played with 1 bonus discard. The active player picks Cleansing Wave from their own hand.
-   **Desired:**

    ```text
    player1 plays Troll
    Troll's bonus icon discards Cleansing Wave
    ```

> Bonus icons **always** resolve one at a time and interrupts can trigger between any two. Bonus discard targets the **active player's own** hand, not the opponent's.

### 4.12 Action ability (Bumpsy)

A simple, single-effect action ability collapses to one line: the player uses the ability, and the effect rides along on the same line.

-   **Card text:** Bumpsy — "Action: gain 1A."
-   **Today:**

    ```text
    player1 uses Bumpsy to gain 1 amber
    ```

-   **Desired:**

    ```text
    player1 uses Bumpsy's action ability to gain 1 amber
    ```

> Compare with omni ([§4.14](#414-use-omni)) and multi-effect action abilities, which lead with `uses {card}'s {category} ability` and then emit one `resolves … to …` line per effect.

### 4.13 Ability granted by another card (upgrade)

-   **Card text:** Minerva's Wings — "Attached creature gains: Action: gain 1A." Attached to Urchin.
-   **Desired:**

    ```text
    Urchin's action ability from Minerva's Wings has player1 gain 1 amber
    ```

> `from {source}` only when the granting source isn't the resolving card.

### 4.14 Use omni

Omni is a player-instigated use with potentially multiple effects. The first line announces the use; subsequent lines emit one `resolves` per effect, same pattern as multi-effect action abilities ([§4.12](#412-action-ability-bumpsy)).

-   **Card text:** Ornate Talking Tray — "Omni: destroy this artifact and make a token creature."
-   **Today (per `omni.spec.js`):**

    ```text
    player1 uses Ornate Talking Tray to destroy Ornate Talking Tray and make a token creature
    ```

-   **Desired:**

    ```text
    player1 uses Ornate Talking Tray's omni ability
    Ornate Talking Tray's omni ability destroys Ornate Talking Tray
    Ornate Talking Tray's omni ability makes a Niffle token creature on the right flank
    ```

### 4.15 Flip a card face-down (Gĕzdrutyŏ the Arcane)

-   **Card text:** Gĕzdrutyŏ the Arcane — "Action: Steal 2A. Flip Gĕzdrutyŏ the Arcane facedown (it becomes a token creature)."
-   **Desired:**

    ```text
    player1 uses Gĕzdrutyŏ the Arcane's action ability
    Gĕzdrutyŏ the Arcane's action ability steals 2 amber from player2
    Gĕzdrutyŏ the Arcane's action ability flips Gĕzdrutyŏ the Arcane face-down into Scholar
    ```

### 4.16 Reap (vanilla)

-   **Card text:** Ganger Chieftain — vanilla reap, no after reap ability.
-   **Today:**

    ```text
    player1 uses Ganger Chieftain to reap with Ganger Chieftain
    ```

-   **Desired:**

    ```text
    player1 reaps with Ganger Chieftain to gain 1 amber
    ```

### 4.17 Steal (Urchin's after reap ability)

-   **Card text:** Urchin — "After Reap: steal 1A."
-   **Today:**

    ```text
    player1 uses Urchin to reap with Urchin
    player1 uses Urchin to steal 1 amber from player2
    ```

-   **Desired:**

    ```text
    player1 reaps with Urchin to gain 1 amber
    Urchin's after reap ability steals 1 amber from player2
    ```

### 4.18 Steal (capped by opponent's amber)

-   **Card text:** hypothetical "After Reap: steal 2A." Opponent has 1.
-   **Desired:**

    ```text
    player1 reaps with Urchin to gain 1 amber
    Urchin's after reap ability steals 1 amber from player2
    ```

> The log reports **what happened**, not what was requested. When the opponent has **0**, we still print: `steal 0 amber from player2` ([§2.5](#25-always-print-a-number-never-silence)).

### 4.19 Reap (capture effect — Urchin, opponent has 0)

-   **Card text:** Urchin — "After Reap: capture 3A."
-   **Desired (opponent has 0):**

    ```text
    player1 reaps with Urchin to gain 1 amber
    Urchin's after reap ability captures 0 amber from player2 onto Urchin
    ```

-   **Desired (opponent has 5):**

    ```text
    player1 reaps with Urchin to gain 1 amber
    Urchin's after reap ability captures 3 amber from player2 onto Urchin
    ```

### 4.20 Chained after-play (Ghosthawk)

-   **Card text:** Ghosthawk — "After Play: reap with each other friendly creature." Urchin (after reap: steal 1) and Troll in play.
-   **Desired:**

    ```text
    player1 deploys Ghosthawk between Urchin and Troll
    Ghosthawk's after play ability reaps with Urchin and has player1 gain 1 amber
    Urchin's after reap ability steals 1 amber from player2
    Ghosthawk's after play ability reaps with Troll and has player1 gain 1 amber
    ```

### 4.21 Fight (vanilla)

-   **Card text:** Troll (6 power) fights Ganger Chieftain (4 power).
-   **Today:**

    ```text
    player1 uses Troll to make Troll fight Ganger Chieftain
    Ganger Chieftain is destroyed
    ```

-   **Desired:**

    ```text
    player1 fights with Troll into Ganger Chieftain
    Troll deals 6 damage to Ganger Chieftain and Ganger Chieftain deals 4 damage to Troll
    Damage destroys Ganger Chieftain (6 damage)
    ```

### 4.22 Fight (before-fight ability — Firespitter)

-   **Card text:** Firespitter — "Before Fight: deal 1D to each enemy creature." Bumpsy and Troll on opponent's side; Firespitter (3 power) fights Troll (6 power).
-   **Desired:**

    ```text
    player1 fights with Firespitter into Troll
    Firespitter's before fight ability deals 1 damage to Bumpsy and Troll
    Firespitter deals 3 damage to Troll and Troll deals 6 damage to Firespitter
    Damage destroys Firespitter (6 damage)
    ```

### 4.23 Fight (hazardous defender — Troll vs Briar Grubbling)

Hazardous fires on the defender before fight damage. If hazardous destroys the attacker, fight damage **never happens**.

-   **Card text:** Briar Grubbling — "Hazardous 5."
-   **Today:**

    ```text
    player1 uses Troll to make Troll fight Briar Grubbling
    player2 uses Briar Grubbling to deal 5 damage to Troll
    Briar Grubbling is destroyed
    ```

-   **Desired:**

    ```text
    player1 fights with Troll into Briar Grubbling
    Briar Grubbling's hazardous ability deals 5 damage to Troll
    Damage destroys Troll (5 damage)
    ```

### 4.24 Fight (assault attacker survives — Shorty vs Dodger)

Assault fires on the attacker as the fight resolves, before normal fight damage. When the attacker survives the pre-damage step, the fight then proceeds on its own line.

-   **Card text:** Shorty — "Assault 4." Shorty (4 power) fights Dodger (5 power, 0 prior damage).
-   **Desired:**

    ```text
    player1 fights with Shorty into Dodger
    Shorty's assault ability deals 4 damage to Dodger
    Shorty deals 4 damage to Dodger and Dodger deals 5 damage to Shorty
    Damage destroys Dodger (8 damage) and Shorty (5 damage)
    ```

> Assault / hazardous are their own line because they resolve in their own step. Fight damage gets its own line for the same reason. Compare with [§4.23](#423-fight-hazardous-defender--troll-vs-briar-grubbling) where hazardous already destroys the attacker, so the fight damage line never happens.

### 4.25 Splash attack

Splash damage resolves at the same time as fight damage, so all the damage from the fight goes on a single line.

-   **Card text:** Chasm Vespid (paraphrased splash 1) fights Ganger Chieftain (4 power); Bumpsy is adjacent to Ganger Chieftain.
-   **Today (per `splash-attack.spec.js`):**

    ```text
    player1 uses Chasm Vespid to make Chasm Vespid fight Ganger Chieftain
    ```

-   **Desired:**

    ```text
    player1 fights Ganger Chieftain with Chasm Vespid
    Chasm Vespid deals 4 damage to Ganger Chieftain, Ganger Chieftain deals 4 damage to Chasm Vespid, and Chasm Vespid's splash attack deals 1 damage to Bumpsy
    Damage destroys Ganger Chieftain (4 damage) and Chasm Vespid (4 damage)
    ```

### 4.26 Poison (keyword on a creature)

Poison is a creature keyword: any damage dealt by that creature in a fight destroys the target outright. It's not a keyword applied to other creatures — it qualifies the damage the poisoned creature deals.

-   **Card text:** Briar Grubbling — "Poison." Briar Grubbling (3 power, poison) fights Troll (6 power, 0 prior damage).
-   **Desired:**

    ```text
    player1 fights with Briar Grubbling into Troll
    Briar Grubbling deals 3 poison damage to Troll and Troll deals 6 damage to Briar Grubbling
    Damage destroys Troll (3 damage) and Briar Grubbling (6 damage)
    ```

> The `poison` qualifier rides on the damage clause for the poisoned source's hit only. For the poisoned target, the `(N damage)` value is the actual damage dealt, even though poison destroys regardless of power.

### 4.27 Elusive

The first time an elusive creature is chosen to be fought each turn, it deals no pending damage and is dealt no pending damage in that fight. Elusive only cancels power damage; damage dealt by keywords or other abilities still applies.

-   **Card text:** Dodger — "Elusive." Troll (6 power) fights Dodger (4 power); Dodger has not yet used its elusive this turn.
-   **Desired (first fight that turn — elusive cancels both sides' power damage):**

    ```text
    player1 fights with Troll into an elusive Dodger
    ```

-   **Desired (second fight that turn — elusive is spent):**

    ```text
    player1 fights with Troll into Dodger
    Troll deals 6 damage to Dodger and Dodger deals 4 damage to Troll
    Damage destroys Dodger (6 damage)
    ```

> When elusive triggers, the fight line carries the `elusive` qualifier on the target and there's no damage line — nothing dealt is the whole story. The keyword is consumed for the turn.

### 4.28 Damage with ward (single target)

-   **Card text:** Bad Penny — "Play: deal 3D to a creature." Dextre is warded.
-   **Today (per `ward.spec.js`):**

    ```text
    player1 uses Bad Penny to deal 3 damage to Dextre
    Dextre's ward token prevents the damage dealt by Bad Penny and is discarded
    ```

-   **Desired:**

    ```text
    player1 plays Bad Penny
    Bad Penny's play ability deals damage to Dextre (3 damage prevented by ward)
    ```

### 4.29 Damage with armor (Witch of the Eye)

-   **Card text:** Witch of the Eye — "After Reap: deal 2D to a creature." Troll has 1 armor remaining and no prior damage.
-   **Desired:**

    ```text
    player1 reaps with Witch of the Eye to gain 1 amber
    Witch of the Eye's after reap ability deals 2 damage to Troll (1 damage prevented by armor and 1 damage dealt)
    ```

### 4.30 Damage to many creatures (mixed defenses)

**Note:** this is very verbose. It may make sense to split the damage and destroy lines even though they cannot be interrupted

The stress test. Poison Wave deals 2D to each creature; 10 creatures in play with assorted defenses.

-   **Card text:** Poison Wave — "Play: Deal 2D to each creature."
-   **Board:** Troll (6, 0 damage), Bumpsy (2, 0), Ganger Chieftain (4, 1 armor), Urchin (2, warded), Ghosthawk (2, invulnerable), Firespitter (3, 2 armor), Kerwollop (5, 4 prior damage), Truebaru (4, 0), Mnemoleech (3, warded **and** 1 armor), Senator Shrix (5, 0).
-   **Desired:**

    ```text
    player1 plays Poison Wave
    Poison Wave's play ability deals damage to Troll (2 damage), Bumpsy (2 damage), Ganger Chieftain (1 damage prevented by armor and 1 damage dealt), Urchin (2 damage prevented by ward), Ghosthawk (2 damage prevented by invulnerable), Firespitter (2 damage prevented by armor and 0 damage dealt), Batdrone (2 damage), Truebaru (2 damage), Mnemoleech (2 damage prevented by ward), and Senator Shrix (2 damage)
    Damage destroys Bumpsy (2 damage) and Batdrone (6 damage)
    ```

> Each target's parens carry that creature's outcome in full ([§2.9](#29-damage-phrasing)). All targets are enumerated even when the card says "each creature". Destructions are emitted on the immediate follow-up line.

### 4.31 Replacement effects ("instead") — Annihilation Ritual

**Note:** the instead wording can be improved, not sure how. Maybe "Annihilation Ritual's constant ability purges Troll"? Not sure how much the instead is needed.

Annihilation Ritual turns destruction into purge. The actual game sequence is:

1. Damage is dealt and the creature is tagged for destruction (`(N damage)` shown on the damage line).
2. Destroyed-triggered abilities fire on their own lines.
3. Cards move to discard — but Annihilation Ritual's replacement effect intercepts the affected card and purges it instead.

-   **Card text:** Annihilation Ritual — "A friendly creature that would be destroyed by damage is purged instead."
-   **Desired (Troll, with Annihilation Ritual in play, takes 6 damage from Poison Wave):**

    ```text
    player1 plays Poison Wave
    Poison Wave's play ability deals damage to Troll (6 damage)
    Damage destroys Troll (6 damage)
    Troll is purged instead of being put in the discard pile, due to Annihilation Ritual's constant ability
    ```

> Normal card movement to the discard pile is implied by the destruction line and isn't re-logged ([§2.14](#214-never-go-silent-on-resolved-abilities)). Only replacement effects produce a follow-up line, because that's what's different. Other "instead" variants live in the per-target parens (damage redirect, heal-instead-of-damage); the discard-step replacement lives on its own line after destroyed-triggers ([§6.8](#68-replacement-effects-and-the-discard-step)).

### 4.32 Enrage (Pestering Blow)

-   **Card text:** Pestering Blow — "Deal 1D to a creature and enrage it."
-   **Today (per `enrage.spec.js`):**

    ```text
    player1 uses Pestering Blow to deal 1 damage and enrage Troll
    ```

-   **Desired:**

    ```text
    player1 plays Pestering Blow
    Pestering Blow's play ability deals 1 damage to Troll
    Pestering Blow's play ability enrages Troll
    ```

> Keyword-token verbs (`enrage`, `stun`, `ward`) and their removals (`unstun {target}`, `remove ward from {target}`, `remove enrage from {target}`) are their own beats and get their own lines ([§2.2](#22-one-line--all-simultaneous-events), [§2.10](#210-keyword-tokens-counters-damage)) — even when the card text combines them with another effect.

### 4.33 Unstun (its own use, even when triggered)

When a stunned creature is forced to reap or fight, it is **unstunned instead** — the reap/fight doesn't happen, only the unstun does. The log treats unstun as its own use.

-   **Today (per `stun.spec.js`, voluntary unstun):**

    ```text
    player1 exhausts Troll to remove its stun
    ```

-   **Desired (voluntary — player exhausts their own creature):**

    ```text
    player1 unstuns Troll
    ```

-   **Desired (forced — Anger "Play: Ready and fight with a friendly creature." targeting stunned Troll):**

    ```text
    player1 plays Anger
    Anger's play ability readies Troll
    Anger's play ability unstuns Troll instead of fighting
    ```

> Ready does not remove stun; only using the creature does. Anger readies stunned Troll, then tries to fight with it — that use triggers the unstun-instead rule. The forced line follows the Bryozoarch pattern ([§4.38](#438-bryozoarch-replaces-an-action-play-effect)): say what happens, then `instead of` what didn't.

### 4.34 Constant ability application (Agamignus)

-   **Card text:** Agamignus — "After another Mutant creature enters play, gain 1A. Fate: destroy each non-Mutant creature."
-   **Desired (a Mutant creature enters play, Agamignus reacts):**

    ```text
    player1 plays Parasitic Arachnoid on the right flank
    Agamignus's constant ability has player1 gain 1 amber
    ```

> The triggering event is visible on the line above. We don't append `due to …` — the reader doesn't need a restatement of what already happened ([§6.9](#69-constant-and-triggered-abilities)).

### 4.35 Constant ability triggers a token (Redeemer Amara)

-   **Card text:** Redeemer Amara — "Each time an enemy creature or a Mutant creature is destroyed, make a token creature."
-   **Desired:**

    ```text
    player1 fights with Briar Grubbling into Troll
    Briar Grubbling's hazardous ability deals 5 damage to Troll
    Damage destroys Troll (5 damage)
    Redeemer Amara's constant ability makes a Niffle token creature on the right flank
    ```

### 4.36 Widespread Corruption (constant reroute of amber)

A constant ability that fires on another player's beat and inserts its own beat into the same bubble. The active player resolves the constant ability even though it's their opponent's card.

-   **Card text:** Widespread Corruption — "After a player gains A by reaping, a creature they do not control captures that A."
-   **Desired (player1 reaps with Urchin; player2 controls Widespread Corruption and player2 chooses Bumpsy as the captor):**

    ```text
    player1 reaps with Urchin to gain 1 amber
    Widespread Corruption's constant ability captures 1 amber from player1 onto Bumpsy
    ```

> Both lines share the reap's `useId` so the bubble shows them together. Even though Widespread Corruption belongs to player2, player1 is the active player and resolves it ([§6.13](#613-cross-player-ability-resolution-and-inserted-beats)).

### 4.37 The Colosseum-style triggered counter

-   **Card text:** The Colosseum — "After a player reaps, place 1 glory counter on The Colosseum."
-   **Desired:**

    ```text
    player2 reaps with Troll to gain 1 amber
    The Colosseum's constant ability places 1 glory counter on The Colosseum
    ```

> Whoever's beat the constant fires inside resolves it ([§4.36](#436-widespread-corruption-constant-reroute-of-amber)). Self-reference uses the card name (`The Colosseum`), never `itself` ([§10](#10-terminology--internal-vs-keyforge)).

### 4.38 Bryozoarch replaces an action play effect

-   **Card text:** Bryozoarch — "Your opponent cannot resolve action play effects. When your opponent plays an action card, destroy the creature on your left flank instead of resolving that action."
-   **Today:**

    ```text
    player2 plays Cleansing Wave
    player1 uses Bryozoarch to destroy Ganger Chieftain instead of resolving Cleansing Wave
    Ganger Chieftain is destroyed
    ```

-   **Desired:**

    ```text
    player2 plays Cleansing Wave
    Bryozoarch's constant ability destroys Ganger Chieftain instead of resolving Cleansing Wave's play ability
    ```

> The active player resolves all abilities, including their opponent's constant abilities that fire during the active player's turn ([§6.13](#613-cross-player-ability-resolution-and-inserted-beats)). Bryozoarch belongs to player1, but it triggers on player2's play, so player2 resolves it. No separate destruction line — destroy is part of the same beat.

### 4.39 Forge

-   **Today:**

    ```text
    player1 forges their yellow key, spending 6 amber
    ```

-   **Desired:**

    ```text
    player1 spends 6 amber to forge their yellow key
    ```

### 4.40 Discard from hand (always one at a time)

-   **Card text:** Mind Barb — "Play: your opponent discards 2 cards from their hand at random."
-   **Desired:**

    ```text
    player2 plays Mind Barb
    Mind Barb's play ability randomly discards Cleansing Wave from player1's hand
    Mind Barb's play ability randomly discards Bumpsy from player1's hand
    ```

> One line per card ([§6.10](#610-one-at-a-time-events-discard-draw)).

### 4.41 Drawing cards (always one at a time)

-   **Desired (draw 2 at end of turn):**

    ```text
    player1 draws a card
    player1 draws a card
    ```

-   **Desired (end-of-turn draw with chains — player1 has 1 chain, draws one fewer card, then sheds 1 chain):**

    ```text
    player1 draws a card
    player1 sheds 1 chain
    ```

> Card names never appear in private draws. The reduced draw count is implicit — the number of `draws a card` lines is the actual number of cards drawn. The `sheds 1 chain` line is its own beat because it changes shared game state the opponent needs to see.

### 4.42 Pick up from archives (start of turn)

Archives pickup happens at the **start of the active player's turn**, not as an announced phase.

-   **Desired:**

    ```text
    player1 picks up 2 cards from their archives
    ```

> Always private — count only, never names. Count `0` is silent (the player just didn't have anything archived).

### 4.42a Play from archives (Project Z.Y.X.)

-   **Card text (paraphrased):** Project Z.Y.X. — "Play: You may play a card from your archives."
-   **Desired (player1 chooses Urchin from their archives):**

    ```text
    player1 plays Project Z.Y.X.
    Project Z.Y.X.'s play ability plays Urchin from player1's archives on the right flank
    ```

> The line names the source zone (`from player1's archives`) because this is a play from a non-hand zone. The card name becomes public at resolution because it enters play.

### 4.43 Abduct (Uxlyx the Zookeeper)

Abduct is an archive into the **abductor's** archives that carries a replacement effect: when the card eventually leaves those archives, it goes to its owner's hand instead of back into play or anywhere else (see [game-actions.md](../docs/game-actions.md#abduct-target-player-)). The archive line itself reads the same as any other archive — the abducted state is tracked silently until the replacement fires.

-   **Desired (Uxlyx reaps and abducts Bumpsy, owned by player2):**

    ```text
    player1 reaps with Uxlyx the Zookeeper to gain 1 amber
    Uxlyx the Zookeeper's after reap ability puts Bumpsy into player1's archives
    ```

-   **Desired (later, player1 picks up their archives at start of turn — Bumpsy returns to player2's hand instead of player1's):**

    ```text
    player1 picks up 2 cards from their archives, returning Bumpsy to player2's hand instead, due to Uxlyx the Zookeeper
    ```

> Pickup and abduct-return are a single action and emit a single line. The base clause keeps its private count shape ([§4.42](#442-pick-up-from-archives-start-of-turn)); the abducted card is named publicly in the same line because the replacement changes its zone in a way the opponent can observe. Same `… instead of {default}, due to {source}` shape as Annihilation Ritual ([§4.31](#431-replacement-effects-instead--annihilation-ritual)).

-   **Desired (Yzphyz Knowdrone tries to purge an abducted card from player1's archives — the abduct replacement returns it to player2's hand instead):**

    ```text
    player1 uses Yzphyz Knowdrone's action ability
    Yzphyz Knowdrone's action ability purges Bumpsy from player1's archives
    Bumpsy is returned to player2's hand instead of being purged, due to Uxlyx the Zookeeper
    ```

> The purge line narrates the attempted zone change; the replacement line corrects it with the `instead of` shape. The abduct replacement fires whenever the card would leave archives by any means — not just pickup — so purge, discard, and shuffle all trigger the same return-to-owner's-hand override.

### 4.44 Graft (Infomancer)

Graft places an action card from hand faceup under the host; the host gains the right to re-trigger the grafted card's play effect later. Card name is public on graft because grafting is a faceup placement.

-   **Desired (Infomancer's play ability grafts Cleansing Wave):**

    ```text
    player1 plays Infomancer
    Infomancer's play ability grafts Cleansing Wave from player1's hand onto Infomancer
    ```

-   **Desired (later, Infomancer reaps and triggers the grafted card):**

    ```text
    player1 reaps with Infomancer to gain 1 amber
    Infomancer's after reap ability triggers Cleansing Wave's play effect
    Cleansing Wave's play ability heals 1 damage from Troll
    Cleansing Wave's play ability has player1 gain 1 amber
    ```

> Graft is its own verb — don't reduce it to `place under` ([§2.12](#212-zone-movement-vocabulary)). The replay on reap reads as a normal play-effect resolution, just with a `use {card}'s play effect` head rather than `plays {card}`, because the card itself isn't being played from hand.

### 4.45 Put under (Jargogle, Cauldron)

Put-under places a card under a host so the host can later act on it. The placement is either **facedown** (the card stays private to its owner until the host reveals it) or **faceup** (the card is public from the moment it's placed). The verb signals which.

-   **Desired (facedown put-under — Jargogle hides one card from player1's hand):**

    ```text
    player1 plays Jargogle
    Jargogle's play ability places a card from player1's hand facedown under Jargogle
    ```

-   **Desired (facedown reveal — Jargogle is destroyed on player1's own turn, the hidden card is played and its name becomes public):**

    ```text
    player1 destroys Jargogle
    Jargogle's destroyed ability plays Batdrone from under Jargogle
    ```

-   **Desired (facedown silent move — Jargogle is destroyed on the opponent's turn, the hidden card is archived instead and stays private):**

    ```text
    Anger's play ability fights with Troll into Jargogle
    Troll deals 8 damage to Jargogle and Jargogle deals 2 damage to Troll
    Damage destroys Jargogle (8 damage)
    Jargogle's destroyed ability archives the card under Jargogle
    ```

-   **Desired (faceup put-under — Cauldron names the card on placement):**

    ```text
    player1 uses Cauldron's omni ability
    Cauldron's omni ability places Pitchoo from player1's deck faceup under Cauldron
    ```

> The facedown placement line names no card (`a card from player1's hand`) because the card is private; the faceup placement line names the card normally. When a host later resolves a card hidden underneath, the reveal is part of that line — either as a normal play (with the card now public) or as a silent archive (still no card name, because archive count is private; see [§4.42](#442-pick-up-from-archives-start-of-turn)).

### 4.46 Ready (as a game action, not a phase)

Ready happens at the end of any step where readying applies. The ready step at end of turn always logs one line — even when nothing readied — so the reader sees the step happened.

-   **Desired (turn-end ready, several creatures exhausted):**

    ```text
    player1 readies Urchin, Troll, and Ghosthawk
    ```

-   **Desired (turn-end, nothing was exhausted):**

    ```text
    player1 readies nothing
    ```

-   **Desired (a card readies a creature mid-turn — Gauntlet of Command "Action: Ready and fight with a friendly creature."):**

    ```text
    player1 uses Gauntlet of Command's action ability
    Gauntlet of Command's action ability readies Troll
    Gauntlet of Command's action ability fights with Troll into Ganger Chieftain
    ```

> The `readies nothing` line is unique to the end-of-turn ready step and fires whenever zero cards actually readied — whether the player had no exhausted cards or every exhausted card was entrenched/blocked from readying. Card-driven ready effects mid-turn don't print a no-op line; if the chosen target was already ready (or otherwise can't ready), the ready resolves to no effect per [§4.47](#447-no-effect-outcomes).

### 4.47 No-effect outcomes

An ability can resolve and do nothing — every target was destroyed before resolution, a condition turned false, or the player intentionally picks a no-op choice when ordering multiple effects. The log uses a single template:

-   **Desired:**

    ```text
    Bad Penny's play ability does nothing
    ```

> Records what happened, not why. The next line in the same bubble (or the surrounding board state) will usually make the cause obvious.

### 4.48 Activate a prophecy

Prophecies start face-down. Activating one places a card from hand underneath as the activation cost.

-   **Card text:** Treat Each Action As Your Last.
-   **Desired:**

    ```text
    player1 activates their prophecy Treat Each Action As Your Last and places a card under it
    ```

> "their prophecy" stays.

### 4.49 Flip a prophecy face-up (Heads, I Win)

-   **Card text:** Heads, I Win — "At the end of your turn, you may flip Heads, I Win." The flip is opt-in at end of turn.
-   **Desired (player1 flips at their end of turn; Heads, I Win switches to the prophecy on the other side of the card):**

    ```text
    player1 flips Heads, I Win into Treat Each Action As Your Last
    ```

> Each prophecy card is double-sided. Flipping switches it to the prophecy on the other side, and the line names both faces (`flips {old face} into {new face}`). Declining the optional flip produces no line. The companion-face card Tails, You Lose works identically, just with the opposite adjacency rule on fulfill.

### 4.50 Fulfill a prophecy (Heads, I Win)

When the prophecy's condition is met, it's fulfilled and the fate card underneath is revealed and resolves its fate ability.

-   **Card text:** Heads, I Win — "During your opponent's turn, after your opponent plays a creature adjacent to a creature of the same house, fulfill Heads, I Win." Fate card under it: Neotechnic Gopher (hypothetical fate: draw 1 card).
-   **Desired:**

    ```text
    player2 plays Snufflegator on the right flank
    player1 fulfills their prophecy Heads, I Win and reveals Neotechnic Gopher
    Neotechnic Gopher's fate ability draws 1 card
    ```

> "Fate ability" — not "fate effect".

### 4.51 Destruction (multi-target destroy — Gateway to Dis)

A destroy effect that names many targets is a single action with one log line; the destroyed creatures are listed in the same line, ordered left-to-right across the battleline.

-   **Card text:** Gateway to Dis — "Destroy each creature."
-   **Desired:**

    ```text
    player1 plays Gateway to Dis
    Gateway to Dis's play ability destroys Troll, Bumpsy, Ganger Chieftain, Urchin, and Ghosthawk
    ```

### 4.52 Engine meta-action (Ifraneye)

Some effects are implemented as a meta-action that orchestrates several atomic sub-actions across players (prompts, ordering, splitting). The meta-action itself does **not** log a line — only its atomic children do. Each child line is attributed to the player whose state is changing, because each opponent discards their **own** hand voluntarily; the bubble's `useId` ties the children back to the source card.

-   **Card text:** Ifraneye — "Each opponent discards their hand."
-   **Desired (player2 plays Ifraneye; player1 — the only opponent — has three cards in hand):**

    ```text
    player2 plays Ifraneye
    player1 discards Cleansing Wave from their hand
    player1 discards Bumpsy from their hand
    player1 discards Truebaru from their hand
    ```

> Meta-actions are an **engine construct** for orchestration. They're silent by design because the atomic actions they delegate to already narrate themselves ([§5.4](#54-engine-meta-actions)).

### 4.53 Move a creature within the battleline

A few cards let a player reposition one of their creatures. The new neighbors anchor the line, same convention as deploy ([§4.10](#410-deploy)).

-   **Card text:** Administrator Pelith — "After Reap: You may move a friendly Sanctum creature anywhere in your battleline."
-   **Desired (Dextre moves from the right flank to between Urchin and Bumpsy):**

    ```text
    player1 reaps with Administrator Pelith to gain 1 amber
    Administrator Pelith's after reap ability moves Dextre between Urchin and Bumpsy
    ```

-   **Desired (Dextre moves to a flank):**

    ```text
    player1 reaps with Administrator Pelith to gain 1 amber
    Administrator Pelith's after reap ability moves Dextre to the left flank
    ```

### 4.54 Treachery and take control

Two related mechanics put a creature on the opposite side of the table from where it started. **Treachery** is a keyword: when a creature with treachery is played, it enters play on the opponent's side under the opponent's control — the swap is baked into the play line itself, not a separate event. **Take control** is an effect-driven swap (Coward's End, Collar of Subordination, Lord Invidius, and ≈20 others) that moves a creature already in play to the other side.

-   **Card text:** Ragatha — "Treachery. After an enemy creature reaps, deal 3 damage to each of Ragatha's neighbors."
-   **Desired (player1 plays Ragatha; treachery deploys it on player2's side):**

    ```text
    player1 plays Ragatha on player2's right flank
    ```

-   **Card text:** Coward's End — "Take control of a creature. At the end of your turn, return it to its owner's control."
-   **Desired (player1 plays Coward's End targeting Troll, controlled by player2):**

    ```text
    player1 plays Coward's End
    Coward's End's play ability takes control of Troll from player2
    ```

-   **Desired (end of turn cleanup):**

    ```text
    player1 returns control of Troll to player2
    ```

-   **Card text:** Collar of Subordination — "You control attached creature."
-   **Desired (player1 plays Collar of Subordination on Troll, controlled by player2):**

    ```text
    player1 plays Collar of Subordination on Troll
    player1 takes control of Troll from player2
    ```

> Treachery's swap rides on the play line itself (`on player2's right flank` names the destination side) — no separate "is taken over" line. Take-control swaps get their own line, either as part of the source's resolution (Coward's End) or as a follow-on to the attach (Collar of Subordination). Same `returns control of {card} to {player}` shape is used for the end-of-turn cleanup of temporary take-control effects.

### 4.55 Play a card from another zone (Talent Scout)

Some cards let a player play a card from a zone other than their hand — most commonly an opponent's hand. The play line names the source zone so the reader can see where the card came from.

-   **Card text:** Talent Scout — "Play: Look at your opponent's hand and play a creature from it as if it were yours. Your opponent takes control of Talent Scout."
-   **Desired (player1 plays Talent Scout; picks Bumpsy from player2's hand; Talent Scout flips to player2 afterward):**

    ```text
    player1 plays Talent Scout
    Talent Scout's play ability looks at player2's hand
    Talent Scout's play ability plays Bumpsy from player2's hand
    player1 gives control of Talent Scout to player2
    ```

> The `look at {player}'s hand` line is public (everyone sees that the look happened) but the contents are private to the looker — same shape as the archives pickup count ([§4.42](#442-pick-up-from-archives-start-of-turn)). The follow-on `takes control of Talent Scout` line reuses the take-control vocabulary from [§4.54](#454-treachery-and-take-control); there's no `from player1` clause because the bubble's source (Talent Scout, owned by player1) already establishes who gave it up.

### 4.56 Enters-play modifiers (ready, stunned, enraged)

A creature normally enters play exhausted with no tokens. A few cards alter that starting state — most commonly entering **ready**, but also **stunned** or **enraged**. These modifiers are intrinsic to how the card enters play (a constant ability on the card itself, not a play-ability resolution), so they ride on the play line itself rather than emitting a follow-on line.

-   **Card text:** Silvertooth — "Silvertooth enters play ready."
-   **Desired:**

    ```text
    player1 plays Silvertooth ready
    ```

-   **Card text:** Gargantodon — "Gargantodon enters play stunned."
-   **Desired:**

    ```text
    player1 plays Gargantodon stunned
    ```

-   **Card text:** Berserker — "Berserker enters play ready and enraged."
-   **Desired (combined modifiers, joined with `and` in card-text order):**

    ```text
    player1 plays Berserker ready and enraged
    ```

> The modifier follows the card name with no comma. When several modifiers apply, they're joined with `and` in the card-text order. Compare with deploy ([§4.10](#410-deploy)) and treachery ([§4.54](#454-treachery-and-take-control)) — same principle of carrying intrinsic play-time context inline rather than spawning a follow-on line. Effects that grant entry modifiers **from elsewhere** (e.g. Improvised Aviation giving an arriving Brobnar creature `enters play ready`) still print the modifier on the same play line, because the modifier is observed when the play resolves.

### 4.57 Manual mode commands

Manual mode lets a player adjust the board outside normal game flow — typically to resolve an ambiguity an automated rule can't handle, or to fix up state in a casual setting. The current implementation lives in [`server/game/chatcommands.js`](server/game/chatcommands.js) and emits each line through `addAlert('danger', …)`; the chat UI renders `danger` alerts with distinctive styling so the reader can see at a glance that the line is a manual intervention rather than a normal game event. The narration record carries `severity: 'danger'` (and the template layer infers `manual: true` from the same flag) — no inline `(manual)` tag is appended to the verb. The phrasing matches what `chatcommands.js` already produces today; the migration just promotes those `addAlert` calls to structured narration records with the same template strings.

-   **Desired (mode toggle):**

    ```text
    player1 is attempting to switch manual mode on
    player1 switches manual mode off
    ```

-   **Desired (manual key adjustments — `/forge`, `/unforge`):**

    ```text
    player1 is attempting to forge the yellow key
    player1 unforges their yellow key
    ```

    > A successful `/forge` queues `ManualKeyForgePrompt`; the actual forge that follows prints through the normal `ForgeAction` ([§4.39](#439-forge)). Only the "is attempting" line is manual.

-   **Desired (manual active-house change — `/active-house`):**

    ```text
    player1 manually changed their active house to brobnar
    ```

-   **Desired (manual deck operations — `/shuffle`, `/draw`, `/discard`, `/discardtopofdeck`, `/mulligan`):**

    ```text
    player1 shuffles their deck
    player1 draws 2 cards to their hand
    player1 discards 1 card at random
    player1 discards 3 cards from top of their deck
    player1 mulligans their hand
    ```

-   **Desired (manual reveal / token / add-card — `/reveal`, `/token`, `/add-card`, `/token-creature`):**

    ```text
    player1 reveals Bumpsy
    player1 uses the /token command to set the amber token count of Troll to 2
    player1 uses the /add-card command to add Cleansing Wave to their hand
    player1 uses /token-creature to put into play a Niffle Ape Token on the right flank with the top card of their deck
    ```

-   **Desired (manual clock controls — `/start-clocks`, `/stop-clocks`, `/modify-clock`):**

    ```text
    player1 restarts the timers
    player1 stops the timers
    player1 adds 60 seconds to their clock
    ```

-   **Desired (manual prompt skip — `/cancel-prompt`):**

    ```text
    player1 skips the current step.
    ```

> Bubble membership ([§2.15](#215-visual-grouping-bubbles)): manual lines do **not** join an active use bubble — they always sit between bubbles, even when issued mid-resolution. The `danger` styling is the reader's cue that the line is outside normal flow; folding it into a bubble would muddy the bubble's narrative thread. If a manual fix-up is needed mid-bubble, the line still prints between bubble lines and the chat UI separates it visually.

### 4.58 Card-type conversion (changeType)

> **Note:** this section is unclear on what the verbage should be. The only thing that is clear is that the MRB uses revert for type changes, so I went with convert.

A handful of cards change a card's type in play — creature ↔ artifact, or creature → upgrade. Today these are implemented card-locally via `ability.effects.changeType(...)` (see [§5.8](#58-engine-actions-that-dont-exist-yet) for the proposed `ConvertCardTypeAction`). The narration verb is **converts** — the verb the rules use for type changes — and the conversion rides on the resolving ability's line as `convert {card} into a/an {newType}`. When the same ability also performs an observable side-effect (place a counter, move the card on the battleline), each emits its own line per [§2.2](#22-one-line--all-simultaneous-events). When the type change is implicit in another verb already on the line (e.g. `put {card} ready on the right flank … as a creature`), no separate convert line is emitted.

-   **Card text:** De-Animator — "Play/After Reap: Put a mineralize counter on a creature." Plus persistent: "Each card that has a mineralize counter on it is considered an artifact and gains, 'Action: Destroy this artifact.'"
-   **Desired (counter goes on; the constant ability sees the new counter and converts the bearer):**

    ```text
    player1 plays De-Animator
    De-Animator's play ability places 1 mineralize counter on Troll
    De-Animator's constant ability converts Troll into an artifact
    ```

    > The convert line is sourced to De-Animator's constant ability — same shape as any other constant-ability resolution ([§6.9](#69-constant-and-triggered-abilities)). When De-Animator later leaves play, the persistent effect drops and the reverse fires:
    >
    > ```text
    > De-Animator's constant ability converts Troll into a creature
    > player1 moves Troll to the right flank of player1's battleline
    > ```
    >
    > The follow-on move is its own line ([§4.53](#453-move-a-creature-within-the-battleline)).

-   **Card text:** Animator — "Action: Move an artifact to a flank of its controller's battleline. For the remainder of the turn, it is a creature with 3 power that belongs to the active house."
-   **Desired (move + convert are two beats of one action):**

    ```text
    player1 uses Animator's action ability to move Pile of Skulls to the right flank of player1's battleline
    Animator's action ability converts Pile of Skulls into a creature with 3 power until end of turn
    ```

    > The +3 power rides on the convert line because it's a property of the converted-into type, not a separate beat. House re-assignment surfaces in the card's UI state and doesn't get its own log line — it's scoped to the same lasting effect and ends with no separate observable trigger.

-   **Card text:** The Mysticeti — "Action: Exhaust 1 or more friendly Untamed creatures. If you do, give The Mysticeti three +1 power counters for each creature exhausted this way and move it anywhere in your battleline as a creature with 0 power and taunt."
-   **Desired (a self-conversion split across the action's beats):**

    ```text
    player1 uses The Mysticeti's action ability to exhaust Dust Pixie and Niffle Ape
    The Mysticeti's action ability places 6 power counters on The Mysticeti
    The Mysticeti's action ability converts The Mysticeti into a creature with taunt
    player1 moves The Mysticeti to the right flank of player1's battleline
    ```

    > Multi-effect action abilities lead with `uses {card}'s {category} ability` and chain `resolves … to …` lines per [§4.12](#412-action-ability-bumpsy). The conversion is its own beat because the type change is the headline event of the action — not a free passenger on the move line.

-   **Card text:** Pupgrade — "Pupgrade may be played as an upgrade instead of a creature, with the text: 'This creature gets +3 power and gains, "Destroyed: Put Pupgrade on the right flank of your battleline as a creature, ready."'"
-   **Desired (creature → upgrade at play time, then a granted destroyed ability puts Pupgrade back as a creature):**

    ```text
    player1 plays Pupgrade as an upgrade, attaching to Troll
    ...
    player2 uses Bumpsy's action ability to destroy Troll
    Troll's destroyed ability from Pupgrade puts Pupgrade on the right flank of player1's battleline as a creature, ready
    ```

    > "as an upgrade" rides the play line itself rather than emitting a separate convert line, because the type is set **at the moment of play** — there's no prior state to convert from. The return on host destruction is narrated as a normal granted-destroyed-ability resolution ([§4.13](#413-ability-granted-by-another-card-upgrade)); the line names the host (Troll) as the ability's owner, Pupgrade as the source, and mirrors the card text's `… as a creature, ready` clause. No standalone `convert` line is needed because `as a creature` already carries the type change on the put-into-play verb. Same shape covers Spontaneous Awakening, Came Back Wrong, and Poltergeistoids.

> **What the log doesn't say.** Attached upgrades and tokens stay on the converted card. Abilities that no longer apply to the new type (a creature's reap on a now-artifact, an artifact's `Action:` on a now-upgrade) become inaccessible. None of that surfaces in the log — it's pure state, derivable from the card type and the rules.

### 4.59 Direct purge and `cannot`-play restriction (Traumatic Echo)

Traumatic Echo is the canonical example of two verbs that aren't otherwise covered in §4: an **active purge** from a known zone (not a replacement-into-purge like Annihilation Ritual, [§4.31](#431-replacement-effects-instead--annihilation-ritual)), and a **`cannot` restriction** that takes effect later.

-   **Card text:** Traumatic Echo — "Play: Purge a card from your discard pile. During your opponent's next turn, they cannot play cards of the purged card's type."
-   **Desired:**

    ```text
    player1 plays Traumatic Echo
    Traumatic Echo's play ability purges Dust Pixie from player1's discard pile
    Traumatic Echo's play ability prevents player2 from playing creature cards during player2's next turn
    ```

> `purge {card} from {zone}` names the source zone because purge moves a card across observable zones (cf. the verb table, [§3.4](#34-keyforge-vernacular-the-verbs-the-log-must-speak)). The restriction line uses `prevents {player} from {playing/using/…}` — the third-person verb form fits the shortened ability head where a `cannot` clause would otherwise dangle without a subject. The restriction is applied here and observable on the player state; no further log lines are emitted when the restriction is later checked (e.g. when player2 chooses a house or skips a play).

### 4.60 Failed play returns to source zone (Wild Wormhole + alpha)

When an ability tries to play a card and the card's play requirement isn't met, the rules say the card "is returned to the place you tried to play it from." The log narrates this as a normal beat followed by an explicit return-to-zone line — the `to no effect` idiom alone would lose the audit trail of where the card ended up.

-   **Card text:** Wild Wormhole — "Play: Play the top card of your deck."
-   **Card text:** Wardrummer — "Alpha. Skirmish. After Wardrummer attacks, ready it." (Alpha: a card with alpha can only be played as the first card of your turn.)
-   **Desired (player1 already played Bumpsy this turn, then plays Wild Wormhole; top of deck is Wardrummer):**

    ```text
    player1 plays Wild Wormhole
    Wild Wormhole's play ability plays Wardrummer from the top of player1's deck
    Wardrummer is returned to the top of player1's deck
    ```

> The play line still names Wardrummer and the source zone (top of deck) — that's the visible reveal Wild Wormhole forces, and hiding it would misrepresent the state change. The trailing `to no effect` records that no play resolved ([§4.47](#447-no-effect-outcomes)); the next line records where the card actually ended up. Same shape for any failed forced play: Kelifi Dragon revealed without enough amber, an omega card in the middle of a chain, or a card with a `cannot play` restriction in effect ([§4.59](#459-direct-purge-and-cannot-play-restriction-traumatic-echo)). The reason isn't restated — `to no effect` plus the visible card identity carry enough context for the reader.

### 4.61 Captured amber returns when a card leaves play

When a creature with captured amber leaves play, the captured amber is **placed** in its controller's opponent's pool. The rules treat this as simultaneous with the card leaving play. The destruction → discard transition has no log line of its own ([§6.8](#68-replacement-effects-and-the-discard-step)), so the return is its own line — but when several creatures leave play in the same window, every return collapses into a single line so the timing matches the rules.

-   **Desired (player1's Bumpsy carries 2 captured amber; player2 destroys it with Anger):**

    ```text
    player2 uses Anger's play ability to fight with Troll into Bumpsy
    Troll deals 4 damage to Bumpsy and Bumpsy deals 2 damage to Troll
    Damage destroys Bumpsy (4 damage)
    player2 places 2 amber in player2's pool from Bumpsy
    ```

-   **Desired (player2 plays Gateway to Dis; player1 controls Bumpsy with 2 captured, Urchin with 1 captured, and Troll with no captured amber):**

    ```text
    player2 plays Gateway to Dis
    Gateway to Dis's play ability destroys Troll, Bumpsy, and Urchin
    player2 places 3 amber in player2's pool from Bumpsy (2 amber) and Urchin (1 amber)
    ```

> The recipient is the actor (`places`) because they're the player whose pool changes. The total leads (`3 amber`); per-creature breakdowns ride in parens after each source name so the reader can audit each contribution. Creatures that left with no captured amber don't appear on the line; if every leaving creature was empty the line is omitted entirely. Same shape applies to any leave-play event (purge, return-to-hand, archive), not just destruction.

---

## 5. Verb taxonomy

### 5.1 "use" — the head verb that's going away

Today, nearly every log line starts with `{player} uses {card} to …`. We replace `use` with the **actual KeyForge verb that just resolved**.

A distinction worth calling out: **action cards** are played from hand (their effect resolves via the play ability — see Cleansing Wave [§4.6](#46-play-action-card--cleansing-wave-with-conditional-gain)), while **Action: abilities** are activated on a card already in play (Bumpsy [§4.12](#412-action-ability-bumpsy)). They use different head verbs: `plays {card}` vs `uses {card}'s action ability`.

| What just happened                                | New head                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Player reaps                                      | `reaps with {card} to gain 1 amber`                                                             |
| Player fights                                     | `fights with {attacker} into {defender}`                                                        |
| Player plays a card                               | `plays {card}` (with flank if relevant)                                                         |
| Player forges                                     | `spends {N} amber to forge their {color} key`                                                   |
| Player picks up archives                          | `picks up {N} cards from their archives`                                                        |
| Player activates / fulfills / flips a prophecy    | `activates / fulfills / flips {prophecy}`                                                       |
| Player uses an Action: ability (single effect)    | `uses {card}'s action ability to {effect}`                                                      |
| Player uses an Action: ability (multiple effects) | `uses {card}'s action ability` + one `{card}'s action ability {verb-phrase}` per effect         |
| Player uses omni                                  | `uses {card}'s omni ability` + one `{card}'s omni ability {verb-phrase}` per effect             |
| Player unstuns a creature                         | `exhausts {card} to unstun {card}` (voluntary); `…, but {target} is unstunned instead` (forced) |
| Play ability resolves                             | `{card}'s play ability {verb-phrase}`                                                           |
| Before-fight / after-fight / hazardous / assault  | `{card}'s {category} ability {verb-phrase}`                                                     |
| After-reap ability                                | `{card}'s after reap ability {verb-phrase}`                                                     |
| After-play ability                                | `{card}'s after play ability {verb-phrase}`                                                     |
| Constant ability fires                            | `{card}'s constant ability {verb-phrase}`                                                       |
| Fate ability resolves                             | `{card}'s fate ability {verb-phrase}`                                                           |
| Bonus icon                                        | `{card}'s bonus icon {verb-phrase}`                                                             |
| Manual mode                                       | `(manual) …`                                                                                    |

### 5.2 Custom card messages — and the "reaction" word

KeyForge has **no "reaction" mechanic** in player-facing rules text — `this.reaction(…)` is an internal implementation category, the same way `this.interrupt(…)` and `this.persistentEffect(…)` are.

Logs say the printed KeyForge ability instead. For triggered abilities printed as `AbilityName: …` or unprinted-but-implicit on `After X` / `Before X` ability text, the log uses **constant**, **after reap**, **after play**, **before fight**, **after fight**, **destroyed**, **hazardous**, **assault**, **fate**, **omni**, **action**, **play**, or **bonus icon** — matching the wording on the card.

-   Today: `player1 resolves The Colosseum's reaction to place 1 glory counter on itself due to player1's reap`
-   Desired: `The Colosseum's constant ability places 1 glory counter on The Colosseum` ([§4.37](#437-the-colosseum-style-triggered-counter))

### 5.3 No phase-as-line

Not logged as their own lines:

-   Start-of-turn and end-of-turn boundaries (turns are visually delineated by the bubbles UI — [§2.15](#215-visual-grouping-bubbles)).
-   Archives step — only the pickup _outcome_ ([§4.42](#442-pick-up-from-archives-start-of-turn)).
-   Draw step — only the individual draws ([§4.41](#441-drawing-cards-always-one-at-a-time)).

The **end-of-turn ready step** does always log a line, including when nothing readied ([§4.46](#446-ready-as-a-game-action-not-a-phase)). Shuffling is event-triggered (deck out, card-induced shuffle) and logs one line: `player1 shuffles their deck`.

### 5.4 Engine meta-actions

Meta-actions are an engine orchestration construct — things like `DiscardHandAction` that schedule order prompts for affected players and then delegate to atomic actions. They're a code-structure concept, not a card concept. The log treats them as transparent: **the meta-action does not emit any line of its own**; only its atomic children do. The atomics carry the play / action / constant ability attribution so they cluster correctly in the bubble.

This is distinct from a single multi-target action (Gateway to Dis, Poison Wave), which is one action with many targets and emits exactly one log line ([§4.51](#451-destruction-multi-target-destroy--gateway-to-dis)).

### 5.5 Zone movement vocabulary

See the table in [§2.12](#212-zone-movement-vocabulary).

### 5.6 Keyword-token, counter, and damage verbs

See the table in [§2.10](#210-keyword-tokens-counters-damage).

### 5.7 Today, missing entirely

-   Archives pickup at turn start ([§4.42](#442-pick-up-from-archives-start-of-turn))
-   Some replacement effects ([§4.31](#431-replacement-effects-instead--annihilation-ritual))
-   `flips face-up` / `becomes a token` lines ([§4.15](#415-flip-a-card-face-down-gezdrutyo-the-arcane))
-   Unstun-instead-of-fight ([§4.33](#433-unstun-its-own-use-even-when-triggered))
-   `(N damage)` total on destruction ([§4.21](#421-fight-vanilla))
-   No-effect outcomes ([§4.47](#447-no-effect-outcomes))
-   Treachery / control change cleanup ([§4.54](#454-treachery-and-take-control))

### 5.8 Engine actions that don't exist yet

Some verbs in the examples above are handled today by **card-local code** rather than dedicated `GameAction` classes under [`server/game/GameActions/`](server/game/GameActions/). Promoting these to first-class actions is a prerequisite for the narration system to record them uniformly. None of these require new card behaviour — they're refactors that surface what cards already do.

-   **`TakeControlAction`** — "take control of" (Coward's End, Lord Invidius, Harland Mindlock, Universal Welcome, Xyp the Implanter, and ≈20 others). Currently each card hand-rolls the control swap and the end-of-turn return. The narration record for [§4.54 treachery](#454-treachery-and-take-control) reads cleanly only if there's one verb to bind to.
-   **`LookAtCardsAction`** (or extending `RevealAction`) — "look at the top N cards" (Drawn Down, Plunder, Flea Market). Today this is mixed into card-local prompt code; the log's `look at the top 3 cards of player2's deck` line in [§6.15](#615-no-custom-message-escape-hatch) needs a structured event to attach to.
-   **Decision-record actions** — `names`, `chooses`, `declares` from [§6.15](#615-no-custom-message-escape-hatch). The engine resolves the prompt and gets the value, but doesn't emit a narration record for the choice itself — cards re-narrate it via custom messages. A thin `NameHouseAction` / `DeclareAction` that produces a record solves this without changing card behaviour.
-   **Replacement-effect records** — the `… instead of {default}, due to {source}` line for [§4.31 Annihilation Ritual](#431-replacement-effects-instead--annihilation-ritual) and Self-Bolstering Automata is currently a card-authored message. Engine support for replacement narration would standardise the phrasing (including the source-leading variant used by [§4.38 Bryozoarch](#438-bryozoarch-replaces-an-action-play-effect)).
-   **`ConvertCardTypeAction`** — card-type changes between creature, artifact, and upgrade ([§4.58](#458-card-type-conversion-changetype)). De-Animator converts an enemy creature into an artifact; Animator and The Mysticeti convert artifacts (or themselves) into creatures; Pupgrade, Spontaneous Awakening, Came Back Wrong, and Poltergeistoids convert a card into an upgrade. Today each card calls `ability.effects.changeType(...)` through a card-local `persistentEffect` / `cardLastingEffect`; promoting this to a dedicated action gives the narration system a uniform `convert {card} into a {new type}` record to bind to (and a clean place to handle the inevitable cascade — dropping inaccessible abilities, keeping tokens and upgrades attached, etc.).
-   **Forge-cancel records** — Keyforgery's cancel-forge interrupt ([§6.15](#615-no-custom-message-escape-hatch)) is card-implemented today. Promoting forge-cancellation to an engine action lets the narration record sit next to the normal `ForgeAction` records.

---

## 6. Design and implementation

### 6.1 Why the old approach can't work

The first cut at narration added a synchronous `narrate()` to a `GameAction` that wrote the chat line up-front:

```js
// ResolveReapAction — the naive version
narrate(context) {
    context.game.addMessage('{0} reaps with {1} to gain 1 amber', context.player, context.source);
    return true;
}
```

This is called from `AbilityResolver.executeHandler`:

```js
this.context.ability.displayMessage(this.context); // ← narrate() runs HERE
this.context.ability.executeHandler(this.context); // ← amber actually moves LATER (async, in a queued step)
```

The line is committed **before the amber gain resolves**. But the amber gain is a nested event whose outcome can be changed by a replacement effect (Dimension Door swaps gain→steal during the reap event's `preResolution` window; armor / ward / invulnerable change a damage outcome; a `cannot` restriction can zero it out). By the time the real outcome is known, the text `to gain 1 amber` is already on the log — a lie.

**Conclusion:** a line that reports an _outcome_ cannot be a string built before the outcome resolves. The engine must emit **structured records as outcomes resolve**, then **assemble lines after the fact**. This is the whole reason for the overhaul ([§1.1](#11-goals), goal 3).

### 6.2 The three nouns: use, frame, clause

| Noun       | What it is                                                                                                                                                    | Lifetime                                     | Log effect                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **use**    | A player-instigated action the player took: reap, fight, play a card, use an Action:/Omni: ability.                                                           | Opened by the top-level `AbilityResolver`.   | Visual grouping only (the bubble, [§2.15](#215-visual-grouping-bubbles)). One `useId` per use.     |
| **frame**  | A single resolving ability that owns a head attribution — either player-instigated (`player1 reaps with X`) or resolved-ability (`X's after reap ability …`). | One per `AbilityResolver` / ability context. | Produces one head line, possibly with clauses merged in or hung beneath it.                        |
| **clause** | One structured outcome of a `GameAction`: amber moved, damage dealt, card destroyed, counter placed, card drawn.                                              | One per resolved game-action event.          | Either **merged** into its frame's head line, or rendered as its own line attributed to the frame. |

A **use can contain multiple frames.** Ghosthawk's "After Play: reap with each other friendly creature" is one use that opens a reap frame per creature ([§4.20](#420-chained-after-play-ghosthawk)). Each frame is one `AbilityResolver`.

A **frame can contain multiple clauses.** A reap frame owns exactly one amber clause (merged into the head). A fight frame owns several damage clauses (coalesced into one damage line) plus destruction clauses (a follow-up line). A play-ability frame owns one clause per effect, each on its own line ([§4.6](#46-play-action-card--cleansing-wave-with-conditional-gain)).

### 6.3 Attribution is free — you don't thread the frame

Every `GameAction` already carries the `context` it resolved under, and `context` already knows:

-   `context.source` — the resolving card (the frame's subject).
-   `context.ability` — the ability, which knows its category (`isReap()`, `isPlay()`, `isFight()`, action/omni, before/after fight, etc.).
-   `context.player` — the active player (the `actor`).
-   `context.ability.grantedBy` — set when an upgrade / constant grants the ability ([§4.13](#413-ability-granted-by-another-card-upgrade)).

So a clause record captures its frame identity **for free** at emit time by snapshotting `{ source, category, actor, grantedBy }` from the context it's already holding. **There is nothing new to thread for attribution.** When `ResolveReapAction` resolves the amber gain via `gainAmber({ reap: true }).resolve(context.player, context)`, it passes the _same context_ — so the amber clause's `source` is the reaping creature and its `category` is "reap". When Urchin's after-reap steal resolves, it's a _different_ ability context (`source` = Urchin, `category` = "after reap"), so it lands on a different frame. The engine's existing context-threading does the work.

> **Frame grouping in practice.** Two clauses belong to the same frame iff they were emitted under the same ability resolution. The simplest correct implementation is **coalesce-up in buffer order**: a clause attaches to the most recently opened, not-yet-flushed frame. Because beats are atomic and non-interruptible ([§2.2](#22-one-line--all-simultaneous-events)), clauses always immediately follow their frame in the buffer — nothing interleaves. (If we ever want belt-and-suspenders, the captured context identity is an exact key; we don't rely on ordering alone.)

### 6.4 The `useId` is for grouping only — assign it lazily

`useId` answers "which bubble does this line live in", nothing more. It does **not** need to be threaded through every game action:

-   The top-level `AbilityResolver` for a player-instigated action opens a `useId` and stashes it on the game (`game.currentUseId`).
-   Every record emitted while that use is open inherits `game.currentUseId`.
-   A record emitted with no use open (rare — engine bookkeeping, manual-mode commands) coalesces under the most recent `useId`, or sits between bubbles ([§4.57](#457-manual-mode-commands), [§6.14](#614-manual-mode)).

Because grouping is the only consumer and the bubbles UI ships last, `useId` can be added with near-zero risk and ignored by the renderer until the client is ready.

### 6.5 Flush at the close of each event window

**Decision: a narration buffer flushes at the close of every `EventWindow`.** The window is the engine's simultaneity boundary and it is exactly the unit the one hard requirement needs: _all simultaneous events render on one line._

-   All clauses gathered **within one window** render together. The fight window's attacker-damage, defender-damage, and splash-damage clauses become **one** `… deals … and … deals …` line ([§4.21](#421-fight-vanilla), [§4.25](#425-splash-attack)).
-   **Nested windows flush independently, in resolution order.** This is what makes the long chains "just work". Walking the worst case — reap with Bot Bookton → play Wild Wormhole → play the revealed card → it deals damage → destruction → a Destroyed: ability resolves — each step is its own window and flushes its own line(s) in order:

    ```text
    player1 reaps with Bot Bookton to gain 1 amber     ← reap window closes
    player1 plays Wild Wormhole                         ← play window closes
    Wild Wormhole's play ability plays Kerwollop …      ← nested play window closes
    Kerwollop's play ability deals 2 damage to …        ← damage window closes (all damage one line)
    Damage destroys …                                   ← destruction window closes
    Redeemer Amara's constant ability makes a token …   ← destroyed-trigger window closes
    ```

    There is no window in this chain whose close would split a set of simultaneous events or merge two non-simultaneous ones — which is why "flush at window close" is correct, not just convenient.

-   A frame with no clauses still renders its head at its window's close (e.g. a bare `player1 plays Troll`).

> **Render transport, for now.** "Flush" can still call `game.addMessage('{0} …', …)` with today's `{0}`-style args so cards / amber / damage icons render unchanged ([§6.15](#615-tags-for-icons)). We're changing _when_ and _from what_ a line is built — not the chat transport. i18next templating ([§6.14](#614-templating)) is a later, isolated swap.

### 6.6 Model amber movement as a descriptor, not a swapped handler

The biggest unlock for replacements is to stop swapping whole handlers and instead describe the movement declaratively on the event. Today Dimension Door does:

```js
// Dimension Door — the OLD way: replace the handler AND print its own line
onReap(event) {
    if (this.enabledForPlayers[event.card.controller.uuid]) {
        this.game.addMessage("{0} steals 1 amber instead of gaining it due to {1}'s effect", event.card.controller, this);
        event.replaceHandler((event) =>
            this.game.actions.steal().resolve(event.context.player.opponent, event.context)
        );
    }
}
```

The reap frame has no idea a steal happened, so Dimension Door is _forced_ to print a second "instead" line. Replace this with an **amber descriptor** that both the handler and the narrator read:

```js
event.amber = {
    operation: 'gain', // gain | steal | capture | lose | pay | give | spend
    amount: 1,
    from: 'commonSupply', // 'commonSupply' | <Player> | <Card>
    to: player // <Player> | <Card>
};
```

-   The **handler** reads the descriptor to actually move the amber.
-   The **narrator** reads the _same_ descriptor to emit the amber clause.
-   A **replacement effect mutates fields** instead of swapping the handler:

    ```js
    // Dimension Door — the NEW way: mutate the descriptor, print nothing
    onReap(event) {
        if (this.enabledForPlayers[event.card.controller.uuid]) {
            event.amber.operation = 'steal';
            event.amber.from = event.context.player.opponent;
        }
    }
    ```

Single source of truth → the reap frame's clause renders `steals 1 amber` automatically, with **no second line and no card-authored string**:

```text
player1 plays Dimension Door
player1 reaps with Infomorph to steal 1 amber
```

> **We keep the three action classes.** `ModifyAmberAction`, `StealAction`, and `CaptureAction` encode real rules differences (steal caps to the opponent's pool; capture places tokens on a card and can capture 0) and have hundreds of call sites. They are _not_ collapsed into one action. Each one (a) populates the descriptor and (b) emits a uniform `amber` clause. The descriptor + uniform clause — not a single action class — is what lets the narrator render any amber movement, and lets replacements retarget it by editing data.

### 6.7 Multi-damage sentence assembly

Fight / damage is the stress test, and it falls out of the same frame + clause + window model with no special casing:

-   **Frame:** `fight(attacker, defender)` → head line `player1 fights with X into Y`.
-   **Clauses:** each `applyDamage` event already knows `amount`, `armorUsed`, `amountApplied`, `warded`, `ignoreArmor` — that is literally the slot table below. Each emits a `deal-damage` clause carrying those slots.
-   **Coalescing:** all `deal-damage` clauses in the fight window render as one sentence ([§2.3](#23-one-sentence-ordered-clauses-for-complex-damage)). Per-target modifier text (`prevented by armor`, `prevented by ward`, `prevented by invulnerable`) is computed **by the renderer from the clause slots**, not by each card — which is what finally kills the scattered `unwardAndCancel`-style `addMessage` calls and makes the phrasing consistent everywhere.
-   **Destruction** is a separate `destroy` clause in the following (sub-)window → the `Damage destroys …` follow-up line. Destroyed-triggered abilities open their own frames in their own windows → their own lines ([§4.35](#435-constant-ability-triggers-a-token-redeemer-amara)).

Each damage atom in the window has slots:

| Slot           | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| `amount`       | Pre-armor / pre-ward (the incoming number on the card)               |
| `applied`      | Damage that actually reduced the creature                            |
| `armor`        | Damage absorbed by armor                                             |
| `warded`       | Ward absorbed the hit (ward token consumed)                          |
| `invulnerable` | Creature was invulnerable                                            |
| `elusive`      | Elusive cancelled the hit (uses the creature's elusive for the turn) |
| `replacedBy`   | Replacement source (Annihilation Ritual, redirect, heal-instead)     |
| `destroyed`    | This hit tagged the creature for destruction                         |

Sentence rules (one sentence per damage window):

1. **Lead:** `{source}'s {category} ability deals damage to {targets, list}`. Each target carries a parens clause with its own outcome ([§2.9](#29-damage-phrasing)). When _all_ targets take the same amount and no modifiers apply, the parens collapse to a single number out front: `deals {N} damage to {targets, list}`.
2. **Per-target parens** carry, in priority order: invulnerable, ward prevention, armor prevention, applied damage. Examples: `(2 damage prevented by invulnerable)`, `(2 damage prevented by ward)`, `(2 damage prevented by armor and 1 damage dealt)`, `(3 damage)`. Elusive doesn't appear here — when it triggers, the fight line itself carries the `an elusive {target}` qualifier and no damage line is emitted ([§4.27](#427-elusive)).
3. **Destruction follow-up line** immediately after the damage line: `Damage destroys {Name} ({N} damage)`, grouped with `and` / commas when multiple. **The line lists only destructions tagged by _that damage line's_ events.** If a Destroyed-triggered ability fires from this hit and itself deals more damage (e.g. plays a follow-on action with `Play: Deal X damage to …`), that damage emits its own pair of lines (damage, then destruction follow-up) — it does not retroactively join the prior pair.
4. **Destroyed-triggered abilities** resolve on **subsequent lines**, one per ability, in turn order ([§4.35](#435-constant-ability-triggers-a-token-redeemer-amara)). If those abilities deal further damage, each new damage event repeats rules 1–3 — its own lead plus immediate destruction follow-up, with no carry-over from prior waves in either direction.
5. **Discard-step replacement effects** ([§6.8](#68-replacement-effects-and-the-discard-step)) follow on their own lines.

### 6.8 Replacement effects and the discard step

After damage and destroyed-triggered abilities resolve, cards that were tagged for destruction would move to the discard pile. That movement is **not logged separately** — the destruction line above it already implies it ([§2.14](#214-never-go-silent-on-resolved-abilities)). When a replacement effect changes the destination, the replacement gets its own line because that's the new fact:

```text
Poison Wave's play ability deals damage to Troll (2 damage)
Damage destroys Troll (8 damage)
Troll is purged instead of being put in the discard pile, due to Annihilation Ritual's constant ability
```

Other movements to discard (move from play to discard, discard from hand, discarded by effect) **are** logged as their own lines — they're not implied by anything above.

Replacements that operate **inside** the damage window (damage redirect, heal-instead) ride inside that target's parens ([§4.31](#431-replacement-effects-instead--annihilation-ritual)).

**`due to {source}` placement.** The replacement line above (Annihilation Ritual) opens with a passive `{target} is …` clause that names no source, so `, due to {source}` is appended for attribution. When the line already opens with `{source}'s {category} ability …` the source is already named and the `due to` tail is omitted — see Bryozoarch ([§4.38](#438-bryozoarch-replaces-an-action-play-effect)) which reads `… instead of resolving Cleansing Wave's play ability` with no `due to`. The rule: name the source once, never twice.

### 6.9 Constant and triggered abilities

Constant abilities (Colosseum's "after reap …", Agamignus's "after a Mutant enters play …", Widespread Corruption's "after a player gains amber by reaping …") use:

```text
{card}'s constant ability {verb-phrase}
```

No `due to …` tail — the previous line in the same bubble is the triggering event, and restating it adds noise without information. When the constant ability fires outside the visible context of the triggering line (rare — mostly for end-of-turn cleanup cascades), the source card name carries enough attribution.

> "Trigger" is not a KeyForge word; the rules text says "after …" / "each time …" / "when …". Logs don't introduce "trigger" either.

### 6.10 One-at-a-time events (discard, draw)

Discards and draws are always one line per card ([§4.40](#440-discard-from-hand-always-one-at-a-time), [§4.41](#441-drawing-cards-always-one-at-a-time)).

### 6.11 Templating

Templates go through the project's existing i18next stack ([`client/i18n.js`](client/i18n.js), translations in [`client/locales/*.json`](client/locales/en.json)). Each narration record has a stable **`verb` key** — `resolve-deal-damage`, `reap`, `forge`, `play-card`, etc. — that resolves to a template string in the locale catalogues:

```json
{
    "resolve-deal-damage": "{{source}}'s {{category}} ability deals {{amount}} damage to {{targets}}",
    "reap": "{{actor}} reaps with {{card}} to gain {{amount}} amber"
}
```

The chat client calls `t(record.verb, record.args)` to render. Args carrying structured refs (cards, players, icons) stay as objects until [§6.12](#612-tags-for-icons) renders them — i18next's `interpolation.escapeValue: false` plus the existing `formatMessageText` traversal in [`Messages.jsx`](client/Components/GameBoard/Messages.jsx) already handle inline React fragments, so the template layer never sees the rendered HTML.

i18next covers what the verb taxonomy needs out of the box:

-   **Named interpolation** (`{{actor}}`) — the default placeholder syntax.
-   **Plurals** — i18next's count-driven plural keys (`reap_one` / `reap_other`) cover singular/plural amber, counter counts, etc. without ICU.
-   **Lists** — wrap `Intl.ListFormat` in a custom i18next formatter and invoke it as `{{targets, list}}`. The formatter produces `Troll`, `Troll and Bumpsy`, or `Troll, Bumpsy, and Ganger Chieftain` per the active locale's `'conjunction'` style. Registration is one-time in [`client/i18n.js`](client/i18n.js):

    ```js
    i18n.services.formatter.add('list', (value, lng) =>
        new Intl.ListFormat(lng, { style: 'long', type: 'conjunction' }).format(value)
    );
    ```

-   **Select / conditional shapes** — handled by choosing the verb key on the server (e.g. `resolve-deal-damage-single` vs `resolve-deal-damage-multi`) rather than by ICU `{var, select, …}`. The record carries the verb that matches what happened; the catalogue holds one template per verb.

Server-side rendering (game logs, replay export) reuses the same JSON catalogues via i18next's Node integration with the `'en'` namespace, so log strings stay stable between client and server.

### 6.12 Tags for icons

Card / amber / damage / key icons are inline tags the client renders to images: `<card id="urchin">Urchin</card>`, `<amber/>`, `<key color="yellow"/>`. The narration record carries structured icon refs; the template layer emits the tags.

### 6.13 Cross-player ability resolution and inserted beats

The hard case for the [§5.1](#51-use--the-head-verb-thats-going-away) verb table is an ability that **fires during another player's beat** — typically an opponent-controlled constant or triggered ability that inserts itself into the active player's resolution. Two anchor cases drive the rules:

1. **Inserted follow-on (Widespread Corruption — "After a player gains A by reaping, a creature they do not control captures that A."):** the original beat finishes coherently, then the reroute prints as its own line sharing the trigger's `useId` so the bubble shows both halves together.

    ```text
    player1 reaps with Urchin to gain 1 amber
    Widespread Corruption's constant ability captures 1 amber from player1 onto Bumpsy
    ```

2. **Replacement (Bryozoarch — "Your opponent cannot resolve action play effects. When your opponent plays an action card, destroy the creature on your left flank instead of resolving that action."):** one beat carries both halves, joined with `instead of` ([§6.8](#68-replacement-effects-and-the-discard-step)). No separate destruction line — destroy is part of the same beat.

    ```text
    player2 plays Cleansing Wave
    Bryozoarch's constant ability destroys Ganger Chieftain instead of resolving Cleansing Wave's play ability
    ```

The general rule: **the active player resolves everything that fires during their turn**, regardless of who controls the card. The `actor` field on the narration record is the active player; the `source` field is the opponent-owned card. The active player isn't named on resolved-ability lines — the bubble's instigating line already names them ([§2.4](#24-ability-attribution-card--category-source-only-when-needed)) — so the template layer just prints `{source}'s {abilityKind} ability …`.

### 6.14 Manual mode

Manual-mode commands go through the same narration record stream: `actor = player`, `source = null`, and `severity: 'danger'` on the record. The template layer emits the same phrasing today's `chatcommands.js` produces; the chat UI styles `danger` records distinctively so the reader sees the line is a manual intervention ([§4.57](#457-manual-mode-commands)). Manual lines always sit **between** bubbles — they don't inherit an active use's `useId` — because folding manual fix-ups into a bubble would dilute the bubble's narrative thread.

### 6.15 No custom-message escape hatch

Each time a card looks "weird enough to need an escape hatch", it really needs one of four structural primitives that fit cleanly into the narration record model. The tour below uses real cards that today author custom message strings; each is reduced to structured records with no free-form chat string from the card.

The primitives:

-   **Decision records** — a verb category like `names`, `chooses`, `declares`, `looks at`, `reveals` that narrates a player's choice as its own structured record. Same actor / useId as the surrounding ability.
-   **Per-arg visibility flags** — each `args` value carries `{value, visibleTo}`; the template emits the real value to viewers in `visibleTo` and a redacted form to others. Public/private split is per arg, not per record. The redacted form names the count (`1 card`) — never `a card`.
-   **Source-attributed lines** — lines that fire because of a previous event reference the **source card** of the new effect, not the prior event. The previous line in the bubble is the context ([§6.9](#69-constant-and-triggered-abilities)).
-   **Instead-of records** — `… instead of {default outcome}, due to {source}` covers Annihilation Ritual ([§4.31](#431-replacement-effects-instead--annihilation-ritual)) and Self-Bolstering Automata when the line opens passive; Bryozoarch ([§4.38](#438-bryozoarch-replaces-an-action-play-effect)) uses the source-leading variant with no `due to` tail ([§6.8](#68-replacement-effects-and-the-discard-step)). Same shape covers damage redirect / heal-instead variants.

The five cards:

#### Keyforgery

> When your opponent would forge a key, that player names a house. Reveal a random card from your hand. If that card is not of the named house, destroy Keyforgery and they do not forge that key (no amber is spent).

Keyforgery interrupts the forge attempt before the amber is spent. The interrupt records come **before** the `spends …` line, and if the interrupt cancels the forge, no `spends` line happens at all.

```text
Keyforgery's constant ability has player2 name a house (Logos)
Keyforgery's constant ability randomly reveals Troll from player1's hand
Keyforgery's constant ability destroys Keyforgery and cancels player2's forge
```

If the revealed card matches the named house, the interrupt resolves to no effect and the forge then proceeds normally with its `spends 6 amber to forge …` line.

`names` and `randomly reveals …` are **decision records** — verb categories that narrate a player's choice as its own structured record.

#### Old Boomy

> Reap: Reveal cards from the top of your deck until you reveal a Brobnar card or choose to stop. Deal 2D to Old Boomy if a Brobnar card was revealed. Archive each card revealed this way.

A loop with player choices. Each reveal is its own resolve line; each stop/continue decision is a decision record:

```text
player1 reaps with Old Boomy to gain 1 amber
Old Boomy's after reap ability reveals Troll from the top of player1's deck
Old Boomy's after reap ability reveals Bumpsy from the top of player1's deck
Old Boomy's after reap ability reveals Briar Grubbling from the top of player1's deck
Old Boomy's after reap ability deals 2 damage to Old Boomy
Old Boomy's after reap ability archives Troll, Bumpsy, and Briar Grubbling
```

#### Ambassador Liu

> Action: Discard a card from your hand. If it is a Dis or Shadows card, steal 1A. If it is a Logos or Untamed card, gain 2A. If it is a Sanctum or Saurian card, capture 3A.

Two distinct verbs (discard, then steal) means two distinct lines. The log records what happened, not which conditional branch the card text took:

```text
player1 uses Ambassador Liu's action ability
Ambassador Liu's action ability discards Troll from player1's hand
Ambassador Liu's action ability steals 1 amber from player2
```

> Logs record what happened, not the card's rules text. The reader sees the discarded card was Shadows and the next line steals 1; that's enough.

#### Self-Bolstering Automata

> Destroyed: If you have any other creatures in play, instead of destroying Self-Bolstering Automata, fully heal it, exhaust it, and move it to a flank. If you do, give it two +1 power counters.

A replacement effect on destruction — same shape as Annihilation Ritual, just self-targeted. Each component action is its own line:

```text
Poison Wave's play ability deals damage to Troll (6 damage) and Self-Bolstering Automata (6 damage)
Damage destroys Troll (6 damage) and Self-Bolstering Automata (6 damage)
Self-Bolstering Automata is fully healed instead of being put in the discard pile, due to Self-Bolstering Automata's destroyed ability
Self-Bolstering Automata's destroyed ability exhausts Self-Bolstering Automata
Self-Bolstering Automata's destroyed ability moves Self-Bolstering Automata to the right flank
Self-Bolstering Automata's destroyed ability places 2 power counters on Self-Bolstering Automata
```

The replacement (heal-instead-of-discard) is one line; the additional effects (exhaust, move, counters) are each their own line, matching the per-effect rule for multi-verb abilities ([§4.6](#46-play-action-card--cleansing-wave-with-conditional-gain)).

#### Drawn Down

> Play: Look at the top 3 cards of your opponent's deck. Discard 1, put 1 on the bottom of their deck, and put 1 on top of their deck.

Look, discard, bottom-of-deck, top-of-deck — four distinct verbs, four lines. Only the discarded card is revealed publicly because it enters a public discard pile. The two cards reordered in the deck stay hidden from the opponent and are logged generically:

```text
player1 plays Drawn Down
Drawn Down's play ability looks at the top 3 cards of player2's deck
Drawn Down's play ability discards Troll from the top of player2's deck
Drawn Down's play ability places a card on the bottom of player2's deck
Drawn Down's play ability places a card on the top of player2's deck
```

> Use `a card` placeholders for outcomes that remain private to the opponent (like top/bottom deck placement here). Name the card when it becomes public (like the discarded card).

---

**Conclusion.** None of the five "hardest" cards we surveyed required a per-card message string. They needed four small additions to the record vocabulary: decision records, per-arg visibility, source-attributed lines, and self-targeted instead-of records. With those, the card writes only its game actions and player prompts — never a chat line. We propose the migration ships with no escape hatch and treats any card that seems to need one as a signal that one of these four primitives is missing.

### 6.16 Build order (reap pilot)

> Steps are tagged **[A]** (Track A — message-neutral engine refactor, ships to `master` early) or **[B]** (Track B — narration, ships on the feature branch). See [§8.0](#80-two-independent-tracks-engine-refactors-vs-narration).

1. **[A] Amber descriptor.** Add `event.amber` to the reap event; the handler dispatches from the descriptor. Ship to `master` message-neutral (no log string changes, no test assertion changes).
2. **[A] Convert Dimension Door** to mutate `event.amber` instead of swapping the handler, **keeping its current message**. Ship to `master`.
3. **[B] Narration buffer + flush.** Add a buffer to `game` (push/flush). Flush + render at `EventWindow` close ([§6.5](#65-flush-at-the-close-of-each-event-window)). Allocate `game.currentUseId` in the top-level `AbilityResolver`; clear it when the use ends.
4. **[B] Reap as a frame.** `ResolveReapAction` pushes a `reap` **frame** record (not a string). The [B] follow-up deletes Dimension Door's `addMessage` and updates [reap.spec.js](../test/server/messages/reap.spec.js) to the coalesced two-line output ([§6.6](#66-model-amber-movement-as-a-descriptor-not-a-swapped-handler)).
5. **[A/B] Then fight / damage** in a separate PR pair, reusing the buffer, frames, window-flush, and renderer that now exist ([§6.7](#67-multi-damage-sentence-assembly)). The damage-slot descriptor is [A]; the sentence assembly is [B].

Keep today's string pipeline running alongside through steps 1–4 ([§8](#8-migration-strategy), Phase 1–2); a verb is only "migrated" once its frame + clauses fully reproduce the §4 shapes.

---

## 7. Testing strategy

### 7.1 Goals

-   Keep the existing exact-string assertions working through migration (most tests today look like `expect(this).toHaveAllChatMessagesBe([...])`).
-   Make it _easier_ to scope assertions to "this turn", "this phase", and "this use".
-   Catch phrasing drift via inline snapshots without forcing snapshots everywhere.

### 7.2 Tools

**(a) String assertions.** Keep `toHaveAllChatMessagesBe([...])` for tests that want exact array-of-strings checks, and add Vitest's `toMatchInlineSnapshot` for end-to-end / regression specs that capture an entire turn or use. The snapshot lives in the test file and updates in place when intentional — ideal for the largest multi-damage / chained-reaction scenarios.

**(b) Multiline normalized strings.** Assertions read like the log itself:

```js
expect(this.getLogs.currentUse()).toEqual(stripIndent`
    player1 reaps with Urchin to gain 1 amber
    Urchin's after reap ability steals 1 amber from player2
`);
```

**(c) Test helpers on `this`:**

-   `this.getLogs.currentTurn()` — all log lines emitted during the active player's current turn.
-   `this.getLogs.currentPhase()` — lines in the current step within the turn.
-   `this.getLogs.currentUse()` — lines in the currently active `useId` bubble (or the most recent one if no use is open).
-   `this.getLogs.lastUse()` — lines in the most recently closed `useId` bubble.
-   `this.getLogs.all()` — full game log.

All return newline-joined strings.

### 7.3 Migration path for tests

-   Existing `toHaveAllChatMessagesBe` calls keep working; the asserted strings change when the card's narration changes.
-   New / rewritten tests use `this.getLogs.currentTurn()` + multiline strings.
-   Snapshot tests live in `test/server/messages/*.snapshot.spec.js` for the fragile multi-damage / chained-reaction turn flows.

---

## 8. Migration strategy

### 8.0 Two independent tracks: engine refactors vs. narration

The work splits into **two tracks with a one-directional dependency**, and they ship on different timelines:

| Track                         | Contents                                                                                                                                                                                                                                              | Branch / timeline                                                                                       | Constraint                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A — Engine refactors**      | Behavior-preserving game-logic changes that the narration later _reads_: the amber descriptor ([§6.6](#66-model-amber-movement-as-a-descriptor-not-a-swapped-handler)), replacement-by-mutation in cards like Dimension Door, the damage-slot fields. | Small PRs straight to `master`, merged **as soon as each is green**.                                    | **Must not change any log string or any test.** Same gameplay, same messages, same assertions. This is the merge gate. |
| **B — Narration / messaging** | The narration buffer, `useId`, frames, clauses, window-close flush, the renderer, reap-as-frame, and all the message-shape changes + their test updates.                                                                                              | The long-lived `feature/messaging-overhaul` branch; merges to `master` only when messaging is complete. | Reads the Track A descriptors. Owns **all** log-string changes.                                                        |

**Why this works:** narration depends on the descriptors, not the other way around. Track A is the foundation; it can land in `master` first and stand on its own because it changes _mechanism, not output_. Track B rebases onto `master` and consumes what Track A built.

**The single rule that keeps them separable:** a Track A PR converts a card to the new mechanism **while leaving its current message exactly as-is**. Dimension Door's PR makes it mutate `event.amber` instead of swapping the handler, but it still emits today's `steals 1 amber instead…` line (now driven by the descriptor) and the existing `reap.spec.js` assertions stay untouched. The two-line coalesced output ([§6.6](#66-model-amber-movement-as-a-descriptor-not-a-swapped-handler)) is a **Track B** change, made later on the feature branch when the renderer exists to produce it.

**Operating checklist:**

1. Author each Track A refactor on its own short-lived branch off `master`; keep it message-neutral (diff touches no `addMessage` text and no `*.spec.js` assertions).
2. Merge Track A PRs to `master` as they land.
3. Rebase the `feature/messaging-overhaul` branch onto `master` after each Track A merge so the descriptors stay in sync and conflicts stay small.
4. Add a **standalone test** to each Track A PR for the thing that actually improves — e.g. two stacked replacement effects composing correctly under the descriptor model, which `replaceHandler` handled fragilely — so the PR has value independent of messaging.
5. When the feature branch is ready, the message-shape changes (and only those) flip the output; the descriptors are already in `master`.

That is the whole of it — there is nothing more to do beyond (a) carving the message-neutral engine refactors into their own PRs, (b) keeping the feature branch rebased on top, and (c) giving each early PR its own test so it justifies itself.

### 8.1 Narration phases (Track B)

**Phase 1 — Narration records, no UI change.** Add `narrate()` to a single GameAction (reap is the pilot). Keep today's messages flowing alongside the new records. Verify records contain enough context to render today's lines.

**Phase 2 — Render chat from records.** Wire the chat client to consume records through the existing string pipeline. Cards still write `effect` / `message`, but the engine ignores them where a record exists.

**Phase 3 — Sweep verbs.** One PR per verb family: reap, fight (with hazardous / assault / splash), play, action / omni, capture / steal, damage (with armor / ward / invulnerable / replacement), forge, draw / discard / archive pickup, prophecy / fate / flip, keyword-token verbs (stun / ward / enrage), zone movement (purge / place under), bonus icons, manual mode.

**Phase 4 — Delete dead code.** Remove `effect` / `effectArgs` from abilities with full narration coverage. Remove ad-hoc `addMessage` sites.

**Phase 5 — Bubbles UI (last).** Client clusters by `useId`. Only after narration is stable ([§6.4](#64-the-useid-is-for-grouping-only--assign-it-lazily)).

---

## 9. Deprecations

Once a verb family is migrated:

-   `effect` / `effectArgs` / `message` / `messageArgs` on individual abilities (where covered by narration).
-   `addMessage` for: forge, archive pickup, draw, discard, ready, shuffle, fight resolution, destruction.
-   `getEffectMessage` on `GameAction` once the action has a `narrate()`.
-   Custom-message `then: { message, messageArgs }` blocks where the game action already narrates.
-   `Event.replaceHandler()` — removed. See §9.1.

### 9.1 Decorator → Event Aggregator: `replaceHandler` removal

The old pattern used `replaceHandler` as a **decorator** — wrapping the event handler to observe outcomes and emit ad-hoc messages:

```javascript
// Old pattern (decorator)
const captureHandler = captureEvent.handler;
captureEvent.replaceHandler((event) => {
    const amberBefore = event.card.amber;
    captureHandler(event);
    const amberCaptured = event.card.amber - amberBefore;
    context.game.addMessage('{0} uses {1} to have {2} capture {3} amber', ...);
});
```

The narration system replaces this with an **event aggregator** pattern — actions push structured records during resolution and the renderer materializes them at flush time:

```javascript
// New pattern (event aggregator)
captureEvent.handler = (event) => {
    const amberBefore = event.card.amber;
    originalHandler(event);
    const amberCaptured = event.card.amber - amberBefore;
    if (amberCaptured > 0) {
        context.game.narration.pushFrame({ verb: 'capture', player, source });
        context.game.narration.pushClause({ verb: 'capture', args: { amount, card, source } });
    }
};
```

**Why the aggregator is better here:**

| Concern       | Decorator                                | Event Aggregator                                   |
| ------------- | ---------------------------------------- | -------------------------------------------------- |
| Composability | Each wrapper only sees its own event     | Multiple actions contribute clauses to one message |
| Coupling      | Wrapper must know message format strings | Producer only knows its verb + data                |
| Coalescing    | Cannot merge messages across events      | Renderer sees all clauses, can combine             |
| Testability   | Must mock or inspect `addMessage` calls  | Assert on structured records before rendering      |

`Event.replaceHandler()` was removed from `Event.js` once `AllocateCaptureAction` (the last caller) switched to narration. The `handler` property remains directly assignable for any code that needs to swap handlers, but the method that existed solely for the decorator pattern is gone.

---

## 10. Terminology — internal vs KeyForge

A glossary of terms that show up in code or rules text but **do not** belong in the chat log. The log uses KeyForge's printed vocabulary; engine implementation details stay internal.

| Internal / avoided term                              | What the log says instead                                      | Notes                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reaction                                             | constant ability / after reap / after play / destroyed ability | `this.reaction(…)` is an implementation category; the log uses the printed KeyForge category ([§5.2](#52-custom-card-messages--and-the-reaction-word)).                                                                                                                                                          |
| interrupt                                            | (specific ability category, e.g. constant ability)             | `interrupt` is an engine term; KeyForge cards print "Before…" or "When…" — the log names the printed category.                                                                                                                                                                                                   |
| persistent effect                                    | constant ability                                               | `persistentEffect(…)` is an engine category.                                                                                                                                                                                                                                                                     |
| rider                                                | (no replacement — reword)                                      | "After-reap rider" → "after reap ability".                                                                                                                                                                                                                                                                       |
| trigger / triggered by                               | (no replacement — omit or reference source card)               | "Trigger" is not a KeyForge term. The previous line in the bubble is the cause; the new line names the source card ([§6.9](#69-constant-and-triggered-abilities)).                                                                                                                                               |
| absorb (for ward)                                    | {N} damage prevented by ward                                   | Ward prevention should be phrased as prevented damage, never absorbs ([§2.9](#29-damage-phrasing)).                                                                                                                                                                                                              |
| make X fight                                         | fight with X / fights with X into Y                            | Fight is the verb; "make fight" is engine wording ([§4.21](#421-fight-vanilla)).                                                                                                                                                                                                                                 |
| amber pool                                           | (drop "pool" — just "from {player}")                           | "Pool" disambiguates pool-amber from on-card amber in rules text but is unnecessary in narration.                                                                                                                                                                                                                |
| gives {player} {N} amber                             | has {player} gain {N} amber                                    | Amber gains on resolved ability lines use `has {player} gain …`; direct player-verb lines keep `player gains …`.                                                                                                                                                                                                 |
| attack                                               | fight                                                          | KeyForge has no "attack" verb.                                                                                                                                                                                                                                                                                   |
| "a card" placeholder                                 | name the card, or use a count (`1 card`)                       | Only redact when genuinely private to the opponent ([Drawn Down §6.15](#615-no-custom-message-escape-hatch)).                                                                                                                                                                                                    |
| effect / message / effectArgs                        | (none — cards stop authoring strings)                          | Engine-side concept, removed in the migration ([§9](#9-deprecations)).                                                                                                                                                                                                                                           |
| addMessage(format, …)                                | structured narration record                                    | Engine-side; the new system replaces ad-hoc message writes with records ([§6](#6-design-and-implementation)).                                                                                                                                                                                                    |
| status (as a noun for stun / ward / enrage / poison) | (none — they're keywords)                                      | KeyForge has no "status" concept. Stun / ward / enrage are keywords tracked by tokens ([§2.10](#210-keyword-tokens-counters-damage)). Poison, splash, deploy, skirmish, taunt, hazardous, assault, elusive are keywords that qualify a verb, not things you apply or remove.                                     |
| "remove poison"                                      | (none — not a thing)                                           | Poison is intrinsic to the creature, not a status to remove.                                                                                                                                                                                                                                                     |
| `itself` / `themselves` (self-reference)             | repeat the card name                                           | In log output a card that affects itself names itself explicitly ([§4.37](#437-the-colosseum-style-triggered-counter)). This doc's own prose and verbatim card-text quotes are exempt.                                                                                                                           |
| opponent's constant fires on your turn               | active player resolves it                                      | The active player resolves every ability that fires during their turn, including their opponent's constant abilities ([§4.36](#436-widespread-corruption-constant-reroute-of-amber), [§4.38](#438-bryozoarch-replaces-an-action-play-effect), [§6.13](#613-cross-player-ability-resolution-and-inserted-beats)). |
