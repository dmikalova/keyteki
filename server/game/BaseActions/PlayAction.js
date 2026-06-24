const BasePlayAction = require('./BasePlayAction');

class PlayAction extends BasePlayAction {
    constructor(card) {
        super(card);
        this.title = 'Play this action';
    }

    executeHandler(context) {
        const originLocation = context.source.location;
        const originOwner =
            originLocation === 'under' ? context.source.parent : context.source.owner;

        context.player.moveCard(context.source, 'being played');
        super.executeHandler(context);
        context.game.queueSimpleStep(() => {
            if (context.source.location === 'being played') {
                // Check if the play was blocked by an alpha restriction
                // on a copied card (e.g. Mimicry copying an alpha action).
                if (context.source.mostRecentEffect('playBlockedByAlpha')) {
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
                                card: context.source,
                                location: originLocation,
                                owner: originOwner
                            }
                        });
                    originOwner.moveCard(context.source, originLocation);
                    return;
                }

                // Legitimate redirect (e.g. High Priest Torvus) or default discard.
                const location =
                    context.source.mostRecentEffect('cardLocationAfterPlay') || 'discard';
                context.source.owner.moveCard(context.source, location);
            }
        });
    }
}

module.exports = PlayAction;
