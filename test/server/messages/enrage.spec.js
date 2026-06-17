describe('Enrage Messages', function () {
    describe('enrage', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'shadows',
                    hand: ['pestering-blow']
                },
                player2: {
                    inPlay: ['troll']
                }
            });
        });

        it('should log correct message when enraging a creature', function () {
            this.player1.play(this.pesteringBlow);
            this.player1.clickCard(this.troll);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Pestering Blow',
                "Pestering Blow's bonus icon has player1 gain 1 amber",
                'player1 uses Pestering Blow to deal 1 damage and enrage Troll'
            ]);
        });
    });
});
