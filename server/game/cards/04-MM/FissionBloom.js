const Card = require('../../Card.js');

class FissionBloom extends Card {
    // Enhance R. (These icons have already been added to cards in your deck.)
    // Action: The next time you play a card this turn, resolve each of its bonus icons an additional time.
    setupCardAbilities(ability) {
        this.action({
            gameAction: ability.actions.untilPlayerTurnEnd((context) => ({
                when: {
                    onCardPlayed: (event) =>
                        event.player === context.player && event.card !== context.source
                },
                multipleTrigger: false,
                triggeredAbilityType: 'interrupt',
                gameAction: ability.actions.cardLastingEffect((context) => ({
                    until: {
                        onResolveBonusIcons: () => true
                    },
                    target: context.event.card,
                    // We don’t know where the card will be played from, so
                    // we allow any location.
                    allowedLocations: 'any',
                    effect: ability.effects.resolveBonusIconsAdditionalTime()
                }))
            }))
        });
    }
}

FissionBloom.id = 'fission-bloom';

module.exports = FissionBloom;
