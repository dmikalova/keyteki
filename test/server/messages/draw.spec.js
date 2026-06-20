describe('Draw Messages', function () {
    describe('draw card', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    inPlay: ['library-of-babble']
                },
                player2: {}
            });
        });

        it('should log correct message when drawing a card', function () {
            this.player1.useAction(this.libraryOfBabble);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                "Library of Babble's action ability will have player1 draw 1 card",
                'player1 draws 1 card'
            ]);
        });
    });

    describe('draw multiple cards', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['timetraveller']
                },
                player2: {}
            });
        });

        it('should log correct message when drawing multiple cards', function () {
            this.player1.play(this.timetraveller);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Timetraveller',
                "Timetraveller's amber bonus icon has player1 gain 1 amber",
                "Timetraveller's play ability will have player1 draw 2 cards",
                'player1 draws 1 card',
                'player1 draws 1 card'
            ]);
        });
    });

    describe('opponent draws a card', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'dis',
                    inPlay: ['dust-imp']
                },
                player2: {
                    inPlay: ['cændle-unit']
                }
            });
        });

        it('should log correct message when opponent draws from C.Æ.N.D.L.E. Unit', function () {
            this.player1.reap(this.dustImp);
            expect(this.player1).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 reaps with Dust Imp to gain 1 amber',
                "C.Æ.N.D.L.E. Unit's constant ability will have player2 draw 1 card",
                'player2 draws 1 card'
            ]);
        });
    });

    describe('refill hand at end of turn', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['phase-shift']
                },
                player2: {}
            });
        });

        it('should log correct message when refilling hand', function () {
            this.player1.play(this.phaseShift);
            this.player1.endTurn();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Phase Shift',
                'player1 uses Phase Shift to allow them to play one non-Logos card this turn',
                'player1 will draw 6 cards to refill their hand to 6 cards',
                'player1 draws 1 card',
                'player1 draws 1 card',
                'player1 draws 1 card',
                'player1 draws 1 card',
                'player1 draws 1 card',
                'player1 draws 1 card',
                'player1: 0 amber (0 keys) player2: 0 amber (0 keys)',
                'player2 does not forge a key. They have 0 amber. The current cost is 6 amber'
            ]);
        });
    });

    describe('refill hand with The Amasser in play', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['phase-shift']
                },
                player2: {
                    token: 'catena-fiend',
                    inPlay: ['the-amasser']
                }
            });
        });

        it('should log refill draw and The Amasser messages', function () {
            this.player1.play(this.phaseShift);
            this.player1.endTurn();
            this.player2.clickPrompt('dis');
            expect(this.player2).isReadyToTakeAction();
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Phase Shift',
                'player1 uses Phase Shift to allow them to play one non-Logos card this turn',
                'player1 will draw 6 cards to refill their hand to 6 cards',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1 draws 1 card',
                'player2 uses The Amasser to make a token creature',
                'player2 puts Catena Fiend into play',
                'player1: 0 amber (0 keys) player2: 0 amber (0 keys)',
                'player2 does not forge a key. They have 0 amber. The current cost is 6 amber',
                'player2 chooses dis as their active house this turn'
            ]);
        });
    });

    describe('draw bonus icons', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['anomaly-exploiter']
                },
                player2: {}
            });
        });

        it('should log correct message when drawing 1 card', function () {
            this.anomalyExploiter.enhancements = ['draw'];
            this.player1.play(this.anomalyExploiter);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's draw bonus icon to draw a card",
                'player1 draws 1 card'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });

        it('should log correct message when drawing 2 card', function () {
            this.anomalyExploiter.enhancements = ['draw', 'draw'];
            this.player1.play(this.anomalyExploiter);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's draw bonus icon to draw a card",
                'player1 draws 1 card',
                "player1 uses Anomaly Exploiter's draw bonus icon to draw a card",
                'player1 draws 1 card'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });

        it('should log correct message in bonus icon order', function () {
            this.anomalyExploiter.enhancements = ['brobnar', 'draw', 'amber', 'draw'];
            this.player1.play(this.anomalyExploiter);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's draw bonus icon to draw a card",
                'player1 draws 1 card',
                "Anomaly Exploiter's amber bonus icon has player1 gain 1 amber",
                "player1 uses Anomaly Exploiter's draw bonus icon to draw a card",
                'player1 draws 1 card'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('amphora captura replacing draw bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['anomaly-exploiter'],
                    inPlay: ['amphora-captura', 'batdrone']
                },
                player2: {
                    amber: 3
                }
            });
        });

        it('should log correct message when draw bonus icon is replaced with capture', function () {
            this.anomalyExploiter.enhancements = ['draw'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickPrompt('capture');
            this.player1.clickCard(this.batdrone);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "Amphora Captura's constant ability resolves Anomaly Exploiter's bonus draw as bonus capture",
                "Anomaly Exploiter's capture bonus icon captures 1 amber from player2 onto Batdrone"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('quantum mouse replacing draw bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['anomaly-exploiter', 'batdrone'],
                    inPlay: ['quantum-mouse']
                },
                player2: {}
            });
        });

        it('should log correct message when draw bonus icon is replaced with discard', function () {
            this.anomalyExploiter.enhancements = ['draw'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickPrompt('discard');
            this.player1.clickCard(this.batdrone);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "Quantum Mouse's constant ability resolves Anomaly Exploiter's bonus draw as bonus discard",
                "Anomaly Exploiter's discard bonus icon has player1 discard Batdrone"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });
});
