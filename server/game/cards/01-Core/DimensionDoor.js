const Card = require('../../Card.js');
const EventRegistrar = require('../../eventregistrar.js');

class DimensionDoor extends Card {
    // Play: For the remainder of the turn, any <A> you would gain from reaping is stolen from your opponent instead.
    setupCardAbilities(ability) {
        this.enabledForPlayers = {};
        this.tracker = new EventRegistrar(this.game, this);
        this.tracker.register([{ 'onReap:preResolution': 'onReap' }]);

        this.play({
            condition: (context) => !!context.player.opponent,
            effect: 'steal amber instead of gaining it while reaping for the remainder of the turn',
            gameAction: ability.actions.untilPlayerTurnEnd({
                effect: ability.effects.customDetachedPlayer({
                    apply: (player) => (this.enabledForPlayers[player.uuid] = true),
                    unapply: (player) => (this.enabledForPlayers[player.uuid] = false)
                })
            })
        });
    }

    onReap(event) {
        if (this.enabledForPlayers[event.card.controller.uuid]) {
            event.amber.operation = 'steal';
            event.amber.from = event.context.player.opponent;
        }
    }
}

DimensionDoor.id = 'dimension-door';

module.exports = DimensionDoor;
