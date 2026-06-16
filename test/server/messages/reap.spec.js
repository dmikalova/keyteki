describe('Reap Messages', function () {
    describe('reap', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'brobnar',
                    inPlay: ['ganger-chieftain']
                },
                player2: {}
            });
        });

        it('should log correct message when reaping', function () {
            this.player1.reap(this.gangerChieftain);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 reaps with Ganger Chieftain to gain 1 amber'
            ]);
        });
    });

    describe('Fading Apparition amber redirect', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'geistoid',
                    inPlay: ['fading-apparition', 'boiler', 'jahneerie']
                },
                player2: {}
            });
            this.fadingApparition.exhaust();
            this.boiler.amber = 1;
        });

        it('should log correct message when redirecting amber from a creature', function () {
            this.player1.reap(this.jahneerie);
            this.player1.clickCard(this.boiler);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 reaps with Jahneerie to gain 1 amber',
                'player1 uses Fading Apparition to take 1 amber from Boiler instead of the common supply'
            ]);
        });
    });

    describe('reap', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    inPlay: ['infomorph'],
                    hand: ['dimension-door']
                },
                player2: {}
            });
        });

        it('should log correct message when reaping', function () {
            this.player1.play(this.dimensionDoor);
            this.player1.reap(this.infomorph);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dimension Door',
                'player1 uses Dimension Door to steal amber instead of gaining it while reaping for the remainder of the turn',
                'player1 reaps with Infomorph to steal 1 amber'
            ]);
        });
    });
});
