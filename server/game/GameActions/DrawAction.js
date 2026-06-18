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

    narrate() {
        return true;
    }

    getDrawAnnouncementEvent(context, player, drawVerb, amount) {
        return context.game.getEvent(EVENTS.unnamedEvent, {}, () => {
            context.game.narration
                .pushFrame({
                    verb: drawVerb,
                    player: context.player,
                    source: drawVerb === 'refillDraw' ? null : context.source,
                    ability: drawVerb === 'refillDraw' ? null : context.ability
                })
                .pushClause({
                    verb: drawVerb,
                    args: {
                        player,
                        amount
                    }
                });
        });
    }

    getAmountAndShedChains(player) {
        let shedChains = false;
        let amount = 0;
        if (this.bonus) {
            amount = 1;
        } else if (this.refill) {
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

    getEventWithAmount(player, context, amount, shedChains) {
        return super.createEvent(
            EVENTS.onDrawCards,
            {
                player: player,
                amount: amount,
                bonus: this.bonus,
                shedChains: shedChains,
                context: context
            },
            (event) => {
                if (event.amount > 0) {
                    event.player.drawCardsToHand(amount, { logDraw: true });
                }

                if (shedChains) {
                    event.player.modifyChains(-1);
                    context.game.narration
                        .pushFrame({
                            verb: 'shedChains',
                            player: event.player
                        })
                        .pushClause({
                            verb: 'shedChains',
                            args: {
                                player: event.player,
                                chains: event.player.chains
                            }
                        });
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
            const drawCount = Math.max(0, amount);
            const drawVerb = this.bonus
                ? 'bonusDraw'
                : this.refill
                ? 'refillDraw'
                : context?.ability
                ? 'abilityDraw'
                : null;

            events.push(
                context.game.getEvent(EVENTS.unnamedEvent, { drawEvents: [] }, (event) => {
                    const announcementEvent = this.getDrawAnnouncementEvent(
                        context,
                        player,
                        drawVerb,
                        drawCount
                    );

                    event.drawEvents.push(announcementEvent);
                    context.game.openEventWindow([announcementEvent]);

                    // Split multi-card draws into single-card events so reactions can interleave.
                    const drawAmounts = drawCount > 1 ? new Array(drawCount).fill(1) : [amount];
                    for (let i = 0; i < drawAmounts.length; i++) {
                        const drawEvent = this.getEventWithAmount(
                            player,
                            context,
                            drawAmounts[i],
                            i === drawAmounts.length - 1 ? shedChains : false
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
        return this.getEventWithAmount(player, context, amount, shedChains);
    }
}

module.exports = DrawAction;
