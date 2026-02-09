describe('Amber Messages', function () {
    describe('gain amber from reap', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'brobnar',
                    inPlay: ['ganger-chieftain']
                },
                player2: {}
            });
        });

        it('should log correct message when reaping for amber', function () {
            this.player1.reap(this.gangerChieftain);
            expect(this).toHaveAllChatMessagesBe([
                'player1 uses Ganger Chieftain to reap with Ganger Chieftain'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('gain amber from bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'untamed',
                    hand: ['dust-pixie']
                },
                player2: {}
            });
        });

        it('should log correct message when gaining amber from bonus icon', function () {
            this.player1.play(this.dustPixie);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dust Pixie',
                "player1 uses Dust Pixie's amber bonus icon to gain 1 amber",
                "player1 uses Dust Pixie's amber bonus icon to gain 1 amber"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('amphora captura replacing amber bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'untamed',
                    hand: ['dust-pixie'],
                    inPlay: ['amphora-captura', 'ancient-bear']
                },
                player2: {
                    amber: 3
                }
            });
        });

        it('should log correct message when amber bonus icon is replaced with capture', function () {
            this.player1.play(this.dustPixie);
            this.player1.clickPrompt('capture');
            this.player1.clickCard(this.ancientBear);
            this.player1.clickPrompt('capture');
            this.player1.clickCard(this.ancientBear);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dust Pixie',
                "player1 uses Amphora Captura to resolve Dust Pixie's amber bonus icon as a capture bonus icon",
                "player1 uses Dust Pixie's capture bonus icon to capture 1 amber onto Ancient Bear",
                "player1 uses Amphora Captura to resolve Dust Pixie's amber bonus icon as a capture bonus icon",
                "player1 uses Dust Pixie's capture bonus icon to capture 1 amber onto Ancient Bear"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('whimsical conjuror replacing amber bonus icon', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'untamed',
                    token: 'niffle-brute',
                    hand: ['dust-pixie'],
                    inPlay: ['whimsical-conjuror']
                },
                player2: {}
            });
        });

        it('should log correct message when amber bonus icon is replaced with token creature', function () {
            this.player1.play(this.dustPixie);
            this.player1.clickPrompt('Token Creature');
            this.player1.clickPrompt('Right');
            this.player1.clickPrompt('Amber');
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dust Pixie',
                "player1 uses Whimsical Conjuror to resolve Dust Pixie's amber bonus icon to make a token creature",
                "player1 uses Dust Pixie's replaced bonus icon to make a token creature",
                'player1 puts Niffle Brute into play',
                "player1 uses Dust Pixie's amber bonus icon to gain 1 amber"
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('gain amber from card ability', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'untamed',
                    hand: ['dust-pixie'],
                    inPlay: ['hunting-witch']
                },
                player2: {}
            });
        });

        it('should log correct message when gaining amber from card ability', function () {
            this.player1.play(this.dustPixie);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Dust Pixie',
                "player1 uses Dust Pixie's amber bonus icon to gain 1 amber",
                "player1 uses Dust Pixie's amber bonus icon to gain 1 amber",
                'player1 uses Hunting Witch to gain 1 amber'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('lose amber', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'dis',
                    hand: ['rotgrub']
                },
                player2: {
                    amber: 2
                }
            });
        });

        it('should log correct message when opponent loses amber', function () {
            this.player1.play(this.rotgrub);
            expect(this).toHaveAllChatMessagesBe([
                'player1 plays Rotgrub',
                'player1 uses Rotgrub to make player2 lose 1 amber'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });

    describe('transfer amber', function () {
        beforeEach(function () {
            this.setupTest({
                player1: {
                    house: 'logos',
                    amber: 2,
                    inPlay: ['dextre']
                },
                player2: {
                    inPlay: ['cap-reigns']
                }
            });
        });

        it('should log correct message when transferring amber', function () {
            this.player1.reap(this.dextre);
            expect(this).toHaveAllChatMessagesBe([
                'player1 uses Dextre to reap with Dextre',
                'player1 uses Dextre to transfer 1 amber from player1'
            ]);
            expect(this.player1).isReadyToTakeAction();
        });
    });
});
