const { EVENTS } = require('../Events/types');
const CardGameAction = require('./CardGameAction');

class PlayCardAction extends CardGameAction {
    setDefaultProperties() {
        this.location = 'hand';
        this.deploy = false;
    }

    setup() {
        super.setup();
        this.name = 'play';
        this.effectMsg = 'play {0}';
    }

    narrate() {
        return true;
    }

    canAffect(card, context) {
        if (!super.canAffect(card, context)) {
            return false;
        }

        if (this.hasLegalPlayAction(card, context)) {
            return true;
        }

        // No legal play action. For plays from a hidden zone we still
        // surface the attempt so getEvent can emit an appropriate message.
        return card.location !== 'hand' && this.getPlayActions(card).length > 0;
    }

    getPlayActions(card) {
        return card.getActions(this.location).filter((action) => action.title.includes('Play'));
    }

    hasLegalPlayAction(card, context) {
        return this.getPlayActions(card).some((action) =>
            this.actionMeetsRequirement(context, action)
        );
    }

    isBlockedWithoutReveal(card, context) {
        // Override: use this.location-scoped play actions rather than the
        // card's current zone, since hidden-zone plays (e.g. Wild Wormhole
        // playing the top of deck) still resolve via the card's hand play
        // action.
        return super.isBlockedWithoutReveal(card, context, this.getPlayActions(card));
    }

    actionMeetsRequirement(context, action) {
        let actionContext = action.createContext(context.player);
        actionContext.ignoreHouse = true;
        return !action.meetsRequirements(actionContext, ['location']);
    }

    resolveAction(context, action) {
        action.deploy = this.deploy;
        let actionContext = action.createContext(context.player);
        actionContext.ignoreHouse = true;
        actionContext.playedByCardEffect = true;
        context.game.resolveAbility(actionContext);
    }

    checkEventCondition(event) {
        return this.canAffect(event.card, event.context);
    }

    getEvent(card, context) {
        let playActions = this.getPlayActions(card).filter((action) =>
            this.actionMeetsRequirement(context, action)
        );

        // Capture location before event resolution may move the card.
        const originLocation = card.location;
        const originOwner = card.location === 'under' ? card.parent : card.owner;
        const isHidden = playActions.length === 0 && this.isBlockedWithoutReveal(card, context);

        return super.createEvent(
            EVENTS.playCardEvent,
            { card: card, context: context, player: context.player },
            (event) => {
                if (!isHidden) {
                    context.game.narration
                        .pushFrame({
                            verb: 'abilityPlay',
                            player: context.player,
                            source: context.source,
                            ability: context.ability
                        })
                        .pushClause({
                            verb: 'abilityPlay',
                            args: { card, location: originLocation, owner: originOwner }
                        });
                }

                if (playActions.length > 1) {
                    context.game.promptWithHandlerMenu(context.player, {
                        activePromptTitle: 'Play ' + card.name + ':',
                        choices: playActions.map((ability) => ability.title),
                        handlers: playActions.map(
                            (ability) => () => this.resolveAction(context, ability)
                        ),
                        source: card
                    });
                } else if (playActions.length === 1) {
                    this.resolveAction(context, playActions[0]);
                } else {
                    event.illegalTarget = true;
                    // Find what imposed the restriction so we can name it in
                    // the message (e.g. "Ember Imp's constant ability restricts…").
                    const restriction = this.findPlayRestriction(card, context);
                    if (isHidden) {
                        context.game.narration
                            .pushFrame({
                                verb: 'cannotPlayHidden',
                                player: context.player,
                                source: context.source,
                                ability: context.ability
                            })
                            .pushClause({
                                verb: 'cannotPlayHidden',
                                args: {
                                    location: originLocation,
                                    owner: originOwner,
                                    restrictor: restriction && restriction.source,
                                    restrictionType: restriction && restriction.type
                                }
                            });
                    } else {
                        context.game.narration
                            .pushFrame({
                                verb: 'cannotPlay',
                                player: context.player,
                                source: context.source,
                                ability: context.ability
                            })
                            .pushClause({
                                verb: 'cannotPlay',
                                args: {
                                    card,
                                    location: originLocation,
                                    owner: originOwner,
                                    restrictor: restriction && restriction.source,
                                    restrictionType: restriction && restriction.type
                                }
                            });
                    }
                }
            }
        );
    }

    findPlayRestriction(card, context) {
        const actions = this.getPlayActions(card);
        if (actions.length === 0) {
            return null;
        }

        const actionContext = actions[0].createContext(context.player);
        actionContext.ignoreHouse = true;
        return (
            card.findRestriction('play', actionContext) ||
            context.player.findRestriction('play', actionContext)
        );
    }
}

module.exports = PlayCardAction;
