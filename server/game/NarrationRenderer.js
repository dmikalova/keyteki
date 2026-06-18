/**
 * Verb-keyed render functions for Narration.
 *
 * Each function signature: (narration, frame, clauses)
 *   - narration — the Narration instance (provides describeSource, game, etc.)
 *   - frame     — the frame record being rendered
 *   - clauses   — array of clause records belonging to this frame
 */

function renderCapture(narration, frame, clauses) {
    const captureClause = clauses.find((c) => c.verb === 'capture');
    if (captureClause) {
        const { amount, card, from } = captureClause.args;
        narration.game.addMessage(
            '{0} captures {1} amber from {2} onto {3}',
            narration.describeSource(frame),
            amount,
            from,
            card
        );
    }
}

function renderTransfer(narration, frame, clauses) {
    const transferClause = clauses.find((c) => c.verb === 'pay' || c.verb === 'giveAmber');
    if (transferClause) {
        const { amount, from, to } = transferClause.args;
        const displayVerb = transferClause.verb === 'giveAmber' ? 'give' : 'pay';
        narration.game.addMessage(
            '{0} has {1} {2} {3} amber to {4}',
            narration.describeSource(frame),
            from,
            displayVerb,
            amount,
            to
        );
    }
}

function renderReap(narration, frame, clauses) {
    const amberClause = clauses.find((c) => c.verb === 'amber');
    if (amberClause) {
        const { operation, amount } = amberClause.args;
        const verb = operation === 'steal' ? 'steal' : 'gain';
        narration.game.addMessage(
            '{0} reaps with {1} to {2} {3} amber',
            frame.player,
            frame.source,
            verb,
            amount
        );
    } else {
        // Fallback — no amber clause (e.g. the gain was prevented entirely)
        narration.game.addMessage('{0} reaps with {1}', frame.player, frame.source);
    }
}

function renderChangeHouse(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'changeHouse');
    if (!clause) {
        return;
    }

    const { card, house, duration } = clause.args;
    const suffix = describeDuration(narration, duration, frame.player);
    narration.game.addMessage(
        "{0} changes {1}'s house to {2}{3}",
        narration.describeSource(frame),
        card,
        house,
        suffix
    );
}

function renderControl(narration, frame, clauses) {
    const controlClause = clauses.find((c) => c.verb === 'takeControl');
    if (!controlClause) {
        return;
    }

    const { card, newController, duration } = controlClause.args;
    const suffix = describeDuration(narration, duration, frame.player);
    if (newController === frame.player) {
        // Active player is gaining control — "take control"
        narration.game.addMessage(
            '{0} has {1} take control of {2}{3}',
            narration.describeSource(frame),
            frame.player,
            card,
            suffix
        );
    } else {
        // Active player is giving control to someone else
        narration.game.addMessage(
            '{0} gives control of {1} to {2}{3}',
            narration.describeSource(frame),
            card,
            newController,
            suffix
        );
    }
}

function renderCopyCard(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'copyCard');
    if (!clause) {
        return;
    }

    const { card, copiedCard } = clause.args;

    if (frame.source?.id === 'mimic-gel') {
        const sourceName = card._copyOriginalName || card.name;
        narration.game.addMessage('{0} enters play as a copy of {1}', sourceName, copiedCard);
        return;
    }

    narration.game.addMessage('{0} copies {1}', narration.describeSource(frame), copiedCard);
}

function renderResolveBonusIconAs(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'resolveBonusIconAs');
    if (!clause) {
        return;
    }

    const { card, fromIcon, replacement, iconReplacement } = clause.args;
    if (iconReplacement) {
        narration.game.addMessage(
            "{0}'s constant ability resolves {1}'s bonus {2} as {3}",
            frame.source,
            card,
            fromIcon,
            replacement
        );
        return;
    }

    narration.game.addMessage(
        "{0}'s constant ability resolves {1}'s bonus {2} to {3}",
        frame.source,
        card,
        fromIcon,
        replacement
    );
}

function renderBonusAmber(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'bonusAmber');
    if (!clause) {
        return;
    }

    const { card, player, amount } = clause.args;
    narration.game.addMessage("{0}'s bonus icon has {1} gain {2} amber", card, player, amount);
}

function renderBonusDiscard(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'bonusDiscard');
    if (!clause) {
        return;
    }

    const { card, player, discarded } = clause.args;
    narration.game.addMessage(
        "{0}'s discard bonus icon has {1} discard {2}",
        card,
        player,
        discarded
    );
}

function renderDrawAnnouncement(narration, frame, clauses) {
    const clause = clauses.find(
        (c) => c.verb === 'refillDraw' || c.verb === 'abilityDraw' || c.verb === 'bonusDraw'
    );
    if (!clause) {
        return;
    }

    const { amount, player } = clause.args;

    if (clause.verb === 'abilityDraw') {
        const category = frame.ability?.getCategory ? frame.ability.getCategory() : 'ability';
        narration.game.addMessage(
            "{0}'s {1} will have {2} draw {3} card{4}",
            frame.source,
            category,
            player,
            amount,
            amount === 1 ? '' : 's'
        );
        return;
    }

    if (clause.verb === 'bonusDraw') {
        narration.game.addMessage('{0} uses {1} to draw a card', player, frame.source);
        return;
    }

    if (clause.verb === 'refillDraw') {
        const targetHandSize = player.hand.length + amount;
        narration.game.addMessage(
            '{0} will draw {1} card{2} to refill their hand to {3} cards',
            player,
            amount,
            amount === 1 ? '' : 's',
            targetHandSize
        );
        return;
    }

    throw new Error(`NarrationRenderer: unsupported draw clause '${clause.verb}'`);
}

function renderFulfillProphecy(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'fulfillProphecy');
    if (!clause) {
        return;
    }

    const { card, childCard } = clause.args;
    narration.game.addMessage(
        "{0}'s prophecy is fulfilled and {1} is revealed",
        card,
        childCard ? childCard : 'nothing'
    );
}

function renderResolveFate(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'resolveFate');
    if (!clause) {
        return;
    }

    narration.game.addMessage(
        '{0} resolves the fate effect of {1}',
        frame.player,
        clause.args.card
    );
}

function renderShedChains(narration, frame, clauses) {
    const clause = clauses.find((c) => c.verb === 'shedChains');
    if (!clause) {
        return;
    }

    narration.game.addMessage(
        '{0} sheds 1 chain to {1} chains',
        clause.args.player,
        clause.args.chains
    );
}

/**
 * Return a duration as a message-safe value for use as a {n} placeholder.
 * Returns a pre-formatted message fragment with leading space when a
 * duration applies, or '' (falsy, so formatMessage skips it) when no
 * suffix is needed.
 */
function describeDuration(narration, duration, player) {
    const fmt = narration.game.gameChat.formatMessage;
    switch (duration) {
        case 'untilPlayerTurnEnd':
            return { message: fmt(" until the end of {0}'s turn", [player]) };
        case 'untilPlayerNextTurnStart':
            return { message: fmt(" until the start of {0}'s next turn", [player]) };
        case 'untilPlayerNextTurnEnd':
            return { message: fmt(" until the end of {0}'s next turn", [player]) };
        case 'untilPhaseEnd':
            return { message: [' until the end of the current step'] };
        case 'lastingEffect':
        case undefined:
            return '';
        default:
            return '';
    }
}

// ── Effect narrators ────────────────────────────────────────────────
//
// Registry of effect-type → narration function for CardLastingEffectAction.
// Each function: (context, card, effect, duration) → pushes frame/clause.
// A null entry means the effect intentionally has no narration and falls
// through to the default "uses X to Y" message format.
//
// Any effect type not listed here will throw, ensuring new effects are
// explicitly opted in or out of narration.
//

function narrateTakeControl(context, card, effect, duration) {
    let newController = effect.getValue();
    context.game.narration.pushFrame({
        verb: 'takeControl',
        player: context.player,
        source: context.source,
        ability: context.ability
    });
    context.game.narration.pushClause({
        verb: 'takeControl',
        args: {
            card: card,
            newController: newController,
            duration: duration
        }
    });
}

function narrateChangeHouse(context, card, effect, duration) {
    let house = effect.getValue();
    context.game.narration.pushFrame({
        verb: 'changeHouse',
        player: context.player,
        source: context.source,
        ability: context.ability
    });
    context.game.narration.pushClause({
        verb: 'changeHouse',
        args: {
            card: card,
            house: house,
            duration: duration
        }
    });
}

function narrateCopyCard(context, card) {
    // TODO: seems like this could handle this more explicitly than implicitly saying token creatures have no target
    // Some copyCard flows (e.g. token creature bonus icons) have no explicit
    // selected target card. Skip narration to avoid emitting an empty
    // "... copies" line with a missing card name.
    if (!context.target) {
        return;
    }

    context.game.narration.pushFrame({
        verb: 'copyCard',
        player: context.player,
        source: context.source,
        ability: context.ability
    });
    context.game.narration.pushClause({
        verb: 'copyCard',
        args: {
            card: card,
            copiedCard: context.target
        }
    });
}

/**
 * Effect type → narrator function.
 *
 * - Function entry: narration is handled; suppresses default effectMsg.
 * - null entry: no narration; falls through to default "uses X to Y" messaging.
 *
 * Any effect type not listed here will throw, ensuring new effects are
 * explicitly opted in or out of narration.
 */
const effectNarrators = {
    // ── Narrated effects ────────────────────────────────────────────
    takeControl: narrateTakeControl,
    changeHouse: narrateChangeHouse,
    copyCard: narrateCopyCard,

    // ── Card effects — intentionally not narrated ───────────────────
    addHouse: null,
    addKeyword: null,
    addTrait: null,
    blank: null,
    blankFight: null,
    blankDestroyed: null,
    bonusDamage: null,
    bonusFightDamage: null,
    canPlayAsUpgrade: null,
    canAttachToArtifacts: null,
    abilityRestrictions: null,
    cardLocationAfterPlay: null,
    changeType: null,
    consideredAsFlank: null,
    customEffect: null,
    doesNotReady: null,
    enterPlayAnywhere: null,
    entersPlayEnraged: null,
    entersPlayReady: null,
    entersPlayStunned: null,
    entersPlayWithEffect: null,
    flipToken: null,
    visibleIn: null,
    gainAbility: null,
    fightAbilitiesAddReap: null,
    forgeAmberSource: null,
    forgeWithOpponentsAmber: null,
    ignores: null,
    limitFightDamage: null,
    modifyArmor: null,
    modifyBonusIcons: null,
    modifyPower: null,
    mustFightIfAble: null,
    playAbilitiesAddReap: null,
    reapAbilitiesAddFight: null,
    removeAllTraits: null,
    removeKeyword: null,
    replaceDamage: null,
    resolveBonusIconsAdditionalTime: null,
    returnToHandFromDiscardAnytime: null,
    setArmor: null,
    setPower: null,
    takeControlPlacement: null,
    entersPlayUnderOpponentsControl: null,
    terminalCondition: null,
    transferDamage: null,

    // ── Player effects — can appear in cardLastingEffect arrays ─────
    abilityTrigger: null,
    additionalCost: null,
    anotherTurn: null,
    canPlay: null,
    canPlayFromOwn: null,
    canPlayHouse: null,
    canPlayNonHouse: null,
    canPlayOrUseHouse: null,
    canPlayOrUseNonHouse: null,
    canUse: null,
    canUseHouse: null,
    canUseNonHouse: null,
    canFightNonHouse: null,
    canReapNonHouse: null,
    canUseNonHouseCreature: null,
    cannotPlayCreaturesOnRight: null,
    canForgeSecondKeyDuringKeyPhase: null,
    cannotForgeMoreThan2KeysInATurn: null,
    captureFromPool: null,
    chooseCardsFromArchives: null,
    countPurgedForHaunted: null,
    delayedEffect: null,
    mayResolveBonusIconsAs: null,
    modifyHandSize: null,
    modifyKeyCost: null,
    modifyTideCost: null,
    noActiveHouseForPlay: null,
    opponentCardsCannotLeaveArchives: null,
    redirectForgeAmber: null,
    restrictHouseChoice: null,
    skipStep: null,
    stealFromPool: null,
    stopHouseChoice: null,
    topCardOfDeckVisible: null
};

/**
 * Look up the narrator for an effect type. Throws on unknown types.
 * Returns the narrator function or null (no-op).
 */
function getEffectNarrator(type) {
    if (!(type in effectNarrators)) {
        throw new Error(
            `NarrationRenderer: unknown effect type '${type}' — ` +
                'add it to effectNarrators in NarrationRenderer.js'
        );
    }

    return effectNarrators[type];
}

/**
 * Narrate an array of lasting effects. Calls registered narrators for each
 * effect that has one; silently skips null (no-op) entries.
 */
function narrateEffects(context, card, effects, duration) {
    for (const e of effects) {
        if (!e.effect?.type) {
            continue;
        }

        let narrator = getEffectNarrator(e.effect.type);
        if (narrator) {
            narrator(context, card, e.effect, duration);
        }
    }
}

// TODO: remove once all lasting effects are narrated via effect narrators
/**
 * Returns true if any effect in the array has a registered (non-null) narrator.
 * Used by CardLastingEffectAction.narrate() to suppress default messaging.
 */
narrateEffects.hasNarration = function (effects) {
    return effects.some((e) => {
        if (!e.effect?.type) {
            return false;
        }

        return getEffectNarrator(e.effect.type) !== null;
    });
};

/** Map of frame verb → render function */
const renderers = {
    reap: renderReap,
    capture: renderCapture,
    pay: renderTransfer,
    giveAmber: renderTransfer,
    takeControl: renderControl,
    changeHouse: renderChangeHouse,
    copyCard: renderCopyCard,
    resolveBonusIconAs: renderResolveBonusIconAs,
    bonusAmber: renderBonusAmber,
    bonusDiscard: renderBonusDiscard,
    bonusDraw: renderDrawAnnouncement,
    abilityDraw: renderDrawAnnouncement,
    refillDraw: renderDrawAnnouncement,
    fulfillProphecy: renderFulfillProphecy,
    resolveFate: renderResolveFate,
    shedChains: renderShedChains
};

module.exports = renderers;
module.exports.narrateEffects = narrateEffects;
