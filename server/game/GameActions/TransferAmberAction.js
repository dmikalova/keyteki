const { EVENTS } = require('../Events/types');
const PlayerAction = require('./PlayerAction');

class TransferAmberAction extends PlayerAction {
    setDefaultProperties() {
        this.amount = 1;
        this.verb = 'pay';
    }

    setup() {
        super.setup();
        this.name = this.verb;
    }

    narrate() {
        return true;
    }

    canAffect(player, context) {
        return (
            player.opponent &&
            player.amber > 0 &&
            this.amount > 0 &&
            super.canAffect(player, context)
        );
    }

    getEvent(player, context) {
        let params = {
            context: context,
            player: player,
            amount: Math.min(this.amount, player.amber)
        };
        return super.createEvent(EVENTS.onTransferAmber, params, (event) => {
            event.player.modifyAmber(-event.amount);
            context.game.actions
                .gainAmber({ amount: event.amount })
                .resolve(event.player.opponent, context);

            context.game.narration
                .pushFrame({
                    verb: this.verb,
                    player: context.player,
                    source: context.source,
                    ability: context.ability
                })
                .pushClause({
                    verb: this.verb,
                    args: {
                        amount: event.amount,
                        from: event.player,
                        to: event.player.opponent
                    }
                });
        });
    }
}

module.exports = TransferAmberAction;
