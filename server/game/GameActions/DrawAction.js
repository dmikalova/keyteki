const { EVENTS } = require('../Events/types');
const PlayerAction = require('./PlayerAction');

class DrawAction extends PlayerAction {
    setDefaultProperties() {
        this.amount = 1;
        this.refill = false;
        this.bonus = false;
        this.effectMsg = null;
    }

    setup() {
        super.setup();
        this.name = 'draw';
        this.customEffectMsg = this.effectMsg;
        // Default effectMsg set here, may be updated in update() based on target
        this.effectMsg = `draw ${this.amount} card${this.amount > 1 ? 's' : ''}`;
    }

    update(context) {
        this.effectMsg = null;
        super.update(context);
        // After target is set, update effectMsg based on whether target is opponent
        if (!this.customEffectMsg && this.target.length > 0) {
            const isOpponent = this.target.some((t) => t !== context.player);
            if (isOpponent) {
                this.effectMsg = `make {0} draw ${this.amount} card${this.amount > 1 ? 's' : ''}`;
            }
        } else if (this.customEffectMsg) {
            this.effectMsg = this.customEffectMsg;
        }
    }

    canAffect(player, context) {
        return (this.amount !== 0 || this.refill) && super.canAffect(player, context);
    }

    defaultTargets(context) {
        return context.player;
    }

    narrate(context) {
        if (!context?.ability || this.bonus || this.refill) {
            return false;
        }

        context.narratedDrawActions = context.narratedDrawActions || new Set();
        context.narratedDrawActions.add(this);

        const narratedTargets = this.target.filter((target) => this.canAffect(target, context));
        for (const target of narratedTargets) {
            const [amount] = this.getAmountAndShedChains(target);
            if (amount <= 0) {
                continue;
            }

            context.game.narration.pushFrame({
                verb: 'abilityDraw',
                player: context.player,
                source: context.source,
                ability: context.ability
            });
            context.game.narration.pushClause({
                verb: 'abilityDraw',
                args: {
                    amount,
                    player: target
                }
            });
        }

        return true;
    }

    getAmountAndShedChains(player) {
        let shedChains = false;
        let amount = 0;
        if (this.refill) {
            if (player.maxHandSize > player.hand.length) {
                amount =
                    player.maxHandSize - player.hand.length - Math.floor((player.chains + 5) / 6);
                shedChains = player.chains > 0;
            }
        } else {
            amount = this.amount;
        }
        return [amount, shedChains];
    }

    getEventWithAmount(player, context, amount, refill, shedChains, refillAnnouncement = null) {
        return super.createEvent(
            EVENTS.onDrawCards,
            {
                player: player,
                amount: amount,
                bonus: this.bonus,
                shedChains: shedChains,
                context: context,
                refillAnnouncement
            },
            (event) => {
                if (event.refillAnnouncement) {
                    context.game.addMessage(
                        '{0} will draw {1} cards to refill their hand to {2} cards',
                        event.player,
                        event.refillAnnouncement.amount,
                        event.refillAnnouncement.targetHandSize
                    );
                }

                if (event.amount > 0) {
                    const logDraw =
                        !this.bonus && !(context?.narratedDrawActions?.has(this) ?? false);
                    const refillSuffix = refill
                        ? ` to refill their hand to ${player.hand.length + amount} cards`
                        : '';
                    event.player.drawCardsToHand(amount, { logDraw, refillSuffix });
                }

                if (shedChains) {
                    event.player.modifyChains(-1);
                    context.game.addMessage(
                        '{0} sheds 1 chain to {1} chains',
                        event.player,
                        event.player.chains
                    );
                }
            }
        );
    }

    getEventArray(context) {
        // Resolve refill and ability-driven draws as one-card events so
        // draw-triggered reactions can naturally interleave between cards.
        let events = [];
        for (let player of this.target.filter((target) => this.canAffect(target, context))) {
            let [amount, shedChains] = this.getAmountAndShedChains(player);

            if (amount <= 1 || (!this.refill && !context?.ability)) {
                events.push(
                    this.getEventWithAmount(player, context, amount, this.refill, shedChains)
                );
                continue;
            }

            const refillAnnouncement = this.refill
                ? {
                      amount,
                      targetHandSize: player.hand.length + amount
                  }
                : null;

            events.push(
                context.game.getEvent(EVENTS.unnamedEvent, { drawEvents: [] }, (event) => {
                    for (let i = 0; i < amount; i++) {
                        const drawEvent = this.getEventWithAmount(
                            player,
                            context,
                            1,
                            false,
                            i === amount - 1 ? shedChains : false,
                            i === 0 ? refillAnnouncement : null
                        );
                        event.drawEvents.push(drawEvent);
                        context.game.openEventWindow([drawEvent]);
                    }
                })
            );
        }

        return events;
    }

    getEvent(player, context) {
        let [amount, shedChains] = this.getAmountAndShedChains(player);
        return this.getEventWithAmount(player, context, amount, this.refill, shedChains);
    }
}

module.exports = DrawAction;
