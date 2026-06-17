const Card = require('../../Card.js');

class AnahitaTheTrader extends Card {
    // Reap: Give control of a friendly artifact to your opponent. If you do, they must give you 2A.
    setupCardAbilities(ability) {
        this.reap({
            condition: (context) => context.player.opponent,
            target: {
                cardType: 'artifact',
                controller: 'self',
                gameAction: ability.actions.cardLastingEffect((context) => ({
                    duration: 'lastingEffect',
                    effect: ability.effects.takeControl(context.player.opponent)
                }))
            },
            then: {
                gameAction: ability.actions.transferAmber({ amount: 2 })
            }
        });
    }
}

AnahitaTheTrader.id = 'anahita-the-trader';

module.exports = AnahitaTheTrader;
