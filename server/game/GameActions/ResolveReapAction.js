const { EVENTS } = require('../Events/types');
const CardGameAction = require('./CardGameAction');

class ResolveReapAction extends CardGameAction {
    setup() {
        this.name = 'reap';
        this.targetType = ['creature'];
        this.effectMsg = 'reap with {0}';
    }

    narrate() {
        return true;
    }

    canAffect(card, context) {
        if (card.location !== 'play area' || !card.checkRestrictions('reap')) {
            return false;
        }

        return card.checkRestrictions('use', context) && super.canAffect(card, context);
    }

    getEvent(card, context) {
        let reapEvent = super.createEvent(EVENTS.onReap, { card: card, context: context }, () => {
            const amber = reapEvent.amber;

            // Push narration records now — after preResolution effects have
            // had a chance to mutate the amber descriptor.
            context.game.narration.pushFrame({
                verb: 'reap',
                player: context.player,
                source: card
            });
            context.game.narration.pushClause({
                verb: 'amber',
                args: {
                    operation: amber.operation,
                    amount: amber.amount,
                    from: amber.from,
                    to: amber.to
                }
            });

            if (amber.operation === 'steal') {
                context.game.actions.steal({ amount: amber.amount }).resolve(amber.from, context);
            } else {
                context.game.actions
                    .gainAmber({ amount: amber.amount, reap: true })
                    .resolve(amber.to, context);
            }
        });

        // Declarative description of the amber this reap moves. Replacement
        // effects (e.g. Dimension Door) mutate this instead of swapping the
        // handler, so the movement stays in one place. See the messaging
        // overhaul doc, §6.6.
        reapEvent.amber = {
            operation: 'gain', // gain | steal
            amount: 1,
            from: 'commonSupply', // 'commonSupply' | <Player>
            to: context.player // <Player>
        };

        reapEvent.addChildEvent(
            context.game.getEvent(EVENTS.onUseCard, {
                card: card,
                context: context,
                reapEvent: reapEvent
            })
        );

        return reapEvent;
    }
}

module.exports = ResolveReapAction;
