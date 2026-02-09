describe('Discard Messages', function () {
    describe('discard card', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'mars',
                    hand: ['mindwarper']
                },
                player2: {}
            });
        });

        it('should log correct message when using discarding a card from hand', function () {
            this.player1.scrap(this.mindwarper);
            expect(this).toHaveAllChatMessagesBe(['player1 discards Mindwarper']);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('discard card with ability', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'mars',
                    hand: ['troll'],
                    inPlay: ['feeding-pit']
                },
                player2: {}
            });
        });

        it('should log correct message when discarding a card using an ability', function () {
            this.player1.useAction(this.feedingPit);
            this.player1.clickCard(this.troll);
            expect(this).toHaveAllChatMessagesBe([
                'player1 uses Feeding Pit',
                'player1 uses Feeding Pit to discard Troll'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('scrap ability', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'mars',
                    hand: ['donor-vox'],
                    inPlay: ['zorg']
                },
                player2: {}
            });
        });

        it('should log correct message when using scrap ability', function () {
            this.player1.scrap(this.donorVox);
            this.player1.clickCard(this.zorg);
            expect(this).toHaveAllChatMessagesBe([
                'player1 discards Donor Vox',
                'player1 uses Donor Vox to give Zorg two +1 power counters'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('discard bonus icons', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['anomaly-exploiter', 'dextre', 'batdrone', 'brillix-ponder']
                },
                player2: {}
            });
        });

        it('should log correct message when discarding 1 card', function () {
            this.anomalyExploiter.enhancements = ['discard'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickCard(this.dextre);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Dextre"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });

        it('should log correct message when discarding 2 cards', function () {
            this.anomalyExploiter.enhancements = ['discard', 'discard'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickCard(this.dextre);
            this.player1.clickCard(this.batdrone);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Dextre",
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Batdrone"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });

        it('should log correct message in bonus icon order', function () {
            this.anomalyExploiter.enhancements = ['logos', 'discard', 'amber', 'discard'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickCard(this.dextre);
            this.player1.clickCard(this.batdrone);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Dextre",
                "player1 uses Anomaly Exploiter's amber bonus icon to gain 1 amber",
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Batdrone"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });

        it('should log correct message when discarding triggers scrap ability', function () {
            this.anomalyExploiter.enhancements = ['discard'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickCard(this.brillixPonder);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Anomaly Exploiter's discard bonus icon to discard Brillix Ponder",
                'player1 uses Brillix Ponder to draw 1 card',
                'player1 draws 1 card'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('amphora captura replacing discard bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    hand: ['anomaly-exploiter', 'dextre'],
                    inPlay: ['amphora-captura', 'batdrone']
                },
                player2: {
                    amber: 3
                }
            });
        });

        it('should log correct message when discard bonus icon is replaced with capture', function () {
            this.anomalyExploiter.enhancements = ['discard'];
            this.player1.play(this.anomalyExploiter);
            this.player1.clickPrompt('capture');
            this.player1.clickCard(this.batdrone);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Anomaly Exploiter',
                "player1 uses Amphora Captura to resolve Anomaly Exploiter's discard bonus icon as a capture bonus icon",
                "player1 uses Anomaly Exploiter's capture bonus icon to capture 1 amber onto Batdrone"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('discard hand', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'dis',
                    hand: ['infernal-terran', 'ember-imp', 'shooler']
                },
                player2: {
                    amber: 3
                }
            });
        });

        it('should log correct message when discarding hand', function () {
            this.player1.scrap(this.infernalTerran);
            this.player1.clickCard(this.emberImp);
            this.player1.clickCard(this.shooler);
            expect(this).toHaveAllChatMessagesBe([
                'player1 discards Infernal Terran',
                "player1 uses Infernal Terran to discard player1's hand",
                'player1 discards Ember Imp from hand',
                'player1 discards Shooler from hand'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('discard hand with scrap draw', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'dis',
                    hand: ['infernal-terran', 'brillix-ponder']
                },
                player2: {
                    amber: 3
                }
            });
        });

        it('should log correct message when discarding hand triggers scrap ability', function () {
            this.player1.scrap(this.infernalTerran);
            this.player1.clickCard(this.brillixPonder);
            expect(this).toHaveAllChatMessagesBe([
                'player1 discards Infernal Terran',
                "player1 uses Infernal Terran to discard player1's hand",
                'player1 discards Brillix Ponder from hand',
                'player1 uses Brillix Ponder to draw 1 card',
                'player1 draws 1 card',
                'player1 discards Hand of Dis from hand'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });
});
